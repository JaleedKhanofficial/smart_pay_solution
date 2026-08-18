import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  FilesService,
  UPLOAD_FOLDERS,
  type StoredUpload,
  type UploadFolder,
  type UploadTarget,
} from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import type { GuarantorDto } from './dto/guarantor.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const CUSTOMER_INCLUDE = {
  guarantors: { orderBy: { position: 'asc' } },
} as const;

export type CustomerWithGuarantors = Prisma.CustomerGetPayload<{
  include: typeof CUSTOMER_INCLUDE;
}>;

/** The three optional CNIC images a customer save may carry (FR-CUS-04-v2). */
export type CustomerUploads = {
  customerCnic?: Express.Multer.File;
  guarantor1Cnic?: Express.Multer.File;
  guarantor2Cnic?: Express.Multer.File;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function uploadFieldFor(position: number): keyof CustomerUploads {
  return position === 1 ? 'guarantor1Cnic' : 'guarantor2Cnic';
}

function folderFor(position: number): UploadFolder {
  return position === 1 ? UPLOAD_FOLDERS.guarantor1 : UPLOAD_FOLDERS.guarantor2;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCustomerDto,
    uploads: CustomerUploads,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<CustomerWithGuarantors> {
    await this.assertCnicIsFree(dto.cnicNumber);
    this.assertGuarantorPositions(dto.guarantors);

    // Every image is checked before anything is written, so a bad third upload
    // cannot leave the first two on disk (FR-CUS-06).
    this.validateUploads(uploads);

    const written: StoredUpload[] = [];

    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const customerFile = await this.storeIfPresent(
          tx,
          written,
          {
            field: 'customerCnic',
            folder: UPLOAD_FOLDERS.customer,
            personName: dto.fullName,
            cnicNumber: dto.cnicNumber,
          },
          uploads.customerCnic,
          actor.id,
        );

        const guarantors: Prisma.GuarantorCreateWithoutCustomerInput[] = [];

        for (const guarantor of dto.guarantors) {
          const field = uploadFieldFor(guarantor.position);

          const guarantorFile = await this.storeIfPresent(
            tx,
            written,
            {
              field,
              folder: folderFor(guarantor.position),
              personName: guarantor.fullName,
              cnicNumber: guarantor.cnicNumber,
            },
            uploads[field],
            actor.id,
          );

          guarantors.push({
            position: guarantor.position,
            fullName: guarantor.fullName,
            fatherName: guarantor.fatherName,
            relationship: guarantor.relationship,
            cnicNumber: guarantor.cnicNumber,
            mobileNumber: guarantor.mobileNumber,
            address: guarantor.address,
            ...(guarantorFile
              ? { cnicFile: { connect: { id: guarantorFile } } }
              : {}),
          });
        }

        return tx.customer.create({
          data: {
            fullName: dto.fullName,
            fatherHusbandName: dto.fatherHusbandName,
            cnicNumber: dto.cnicNumber,
            mobileNumber: dto.mobileNumber,
            address: dto.address,
            occupation: dto.occupation,
            monthlyIncome: new Prisma.Decimal(dto.monthlyIncome),
            cnicFileId: customerFile,
            guarantors: { create: guarantors },
          },
          include: CUSTOMER_INCLUDE,
        });
      });

      await this.audit.record({
        actorId: actor.id,
        entity: 'customer',
        entityId: String(customer.id),
        action: 'create',
        after: this.forAudit(customer),
        ip,
      });

      return customer;
    } catch (error) {
      await this.files.discard(written);

      throw error;
    }
  }

  /** FR-CUS-01: newest first, paginated, searchable by name, CNIC or mobile. */
  async findAll(
    query: ListCustomersDto,
  ): Promise<Paginated<CustomerWithGuarantors>> {
    const where: Prisma.CustomerWhereInput = { deletedAt: null };

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { cnicNumber: { contains: query.search } },
        { mobileNumber: { contains: query.search } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: CUSTOMER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      data,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(id: number): Promise<CustomerWithGuarantors> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: CUSTOMER_INCLUDE,
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" was not found`);
    }

    return customer;
  }

  async update(
    id: number,
    dto: UpdateCustomerDto,
    uploads: CustomerUploads,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<CustomerWithGuarantors> {
    const before = await this.findOne(id);

    if (dto.cnicNumber && dto.cnicNumber !== before.cnicNumber) {
      await this.assertCnicIsFree(dto.cnicNumber, id);
    }

    if (dto.guarantors) this.assertGuarantorPositions(dto.guarantors);

    this.validateUploads(uploads);

    const written: StoredUpload[] = [];
    // FR-CUS-07: an omitted image keeps the existing file; a replacement marks
    // the old one for deletion once the transaction commits.
    const replaced: string[] = [];

    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        let cnicFileId = before.cnicFileId;

        if (uploads.customerCnic) {
          if (before.cnicFileId) replaced.push(before.cnicFileId);

          cnicFileId = await this.storeIfPresent(
            tx,
            written,
            {
              field: 'customerCnic',
              folder: UPLOAD_FOLDERS.customer,
              // Falls back to the stored values when the edit only swaps the image.
              personName: dto.fullName ?? before.fullName,
              cnicNumber: dto.cnicNumber ?? before.cnicNumber,
            },
            uploads.customerCnic,
            actor.id,
          );
        }

        if (dto.guarantors) {
          for (const guarantor of dto.guarantors) {
            const field = uploadFieldFor(guarantor.position);
            const existing = before.guarantors.find(
              (row) => row.position === guarantor.position,
            );

            let guarantorFileId = existing?.cnicFileId ?? null;

            if (uploads[field]) {
              if (existing?.cnicFileId) replaced.push(existing.cnicFileId);

              guarantorFileId = await this.storeIfPresent(
                tx,
                written,
                {
                  field,
                  folder: folderFor(guarantor.position),
                  personName: guarantor.fullName,
                  cnicNumber: guarantor.cnicNumber,
                },
                uploads[field],
                actor.id,
              );
            }

            const fields = {
              fullName: guarantor.fullName,
              fatherName: guarantor.fatherName,
              relationship: guarantor.relationship,
              cnicNumber: guarantor.cnicNumber,
              mobileNumber: guarantor.mobileNumber,
              address: guarantor.address,
              cnicFileId: guarantorFileId,
            };

            await tx.guarantor.upsert({
              where: {
                customerId_position: {
                  customerId: id,
                  position: guarantor.position,
                },
              },
              create: {
                customerId: id,
                position: guarantor.position,
                ...fields,
              },
              update: fields,
            });
          }
        } else if (uploads.guarantor1Cnic || uploads.guarantor2Cnic) {
          // Images can be replaced without resubmitting the guarantor details.
          for (const position of [1, 2]) {
            const field = uploadFieldFor(position);
            const upload = uploads[field];

            if (!upload) continue;

            const existing = before.guarantors.find(
              (row) => row.position === position,
            );

            if (!existing) continue;

            if (existing.cnicFileId) replaced.push(existing.cnicFileId);

            const fileId = await this.storeIfPresent(
              tx,
              written,
              {
                field,
                folder: folderFor(position),
                personName: existing.fullName,
                cnicNumber: existing.cnicNumber,
              },
              upload,
              actor.id,
            );

            await tx.guarantor.update({
              where: { id: existing.id },
              data: { cnicFileId: fileId },
            });
          }
        }

        return tx.customer.update({
          where: { id },
          data: {
            fullName: dto.fullName,
            fatherHusbandName: dto.fatherHusbandName,
            cnicNumber: dto.cnicNumber,
            mobileNumber: dto.mobileNumber,
            address: dto.address,
            occupation: dto.occupation,
            monthlyIncome:
              dto.monthlyIncome === undefined
                ? undefined
                : new Prisma.Decimal(dto.monthlyIncome),
            cnicFileId,
          },
          include: CUSTOMER_INCLUDE,
        });
      });

      await this.files.removeAfterCommit(replaced);

      await this.audit.record({
        actorId: actor.id,
        entity: 'customer',
        entityId: String(id),
        action: 'update',
        before: this.forAudit(before),
        after: this.forAudit(customer),
        ip,
      });

      return customer;
    } catch (error) {
      await this.files.discard(written);

      throw error;
    }
  }

  /**
   * FR-CUS-09-v2: soft delete, blocked with 409 and the blocking contract list
   * while the customer still has live contracts.
   */
  async remove(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const before = await this.findOne(id);

    const blocking = await this.prisma.contract.findMany({
      where: { customerId: id, deletedAt: null },
      select: { id: true, status: true, startDate: true },
    });

    if (blocking.length) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message:
          'This customer still has contracts. Delete or reassign them first.',
        blockingContracts: blocking,
      });
    }

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'customer',
      entityId: String(id),
      action: 'soft_delete',
      before: this.forAudit(before),
      ip,
    });
  }

  /**
   * Guarantor 1 is required, guarantor 2 is optional — a deliberate relaxation
   * of FR-CUS-03-v2, which asks for exactly two. A repeated position would
   * otherwise reach the unique index and surface as a 500.
   */
  private assertGuarantorPositions(guarantors: GuarantorDto[]): void {
    const positions = guarantors.map((row) => row.position);

    if (positions.length !== new Set(positions).size) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'each guarantor must have a different position',
        fieldErrors: {
          guarantors: 'Guarantor 1 and guarantor 2 cannot share a position',
        },
      });
    }

    if (!positions.includes(1)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'guarantor 1 is required',
        fieldErrors: { guarantors: 'Guarantor 1 is required' },
      });
    }
  }

  private validateUploads(uploads: CustomerUploads): void {
    for (const field of [
      'customerCnic',
      'guarantor1Cnic',
      'guarantor2Cnic',
    ] as const) {
      const upload = uploads[field];

      if (upload) this.files.assertValidImage(field, upload);
    }
  }

  private async storeIfPresent(
    tx: Prisma.TransactionClient,
    written: StoredUpload[],
    target: UploadTarget,
    upload: Express.Multer.File | undefined,
    uploadedById: string,
  ): Promise<string | null> {
    if (!upload) return null;

    const stored = await this.files.store(tx, target, upload, uploadedById);

    written.push(stored);

    return stored.fileId;
  }

  /**
   * Checked in the service so the client gets a field-level 409 (FR-CUS-08);
   * the partial unique index `uq_customers_cnic_live` remains the real guard.
   */
  private async assertCnicIsFree(
    cnicNumber: string,
    exceptId?: number,
  ): Promise<void> {
    const clash = await this.prisma.customer.findFirst({
      where: {
        cnicNumber,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `A customer with CNIC "${cnicNumber}" already exists`,
        fieldErrors: { cnicNumber: 'This CNIC is already registered' },
      });
    }
  }

  /** Decimal and Date do not survive JSONB cleanly, so normalise first. */
  private forAudit(customer: CustomerWithGuarantors): Prisma.InputJsonValue {
    return {
      ...customer,
      monthlyIncome: customer.monthlyIncome.toString(),
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      deletedAt: customer.deletedAt?.toISOString() ?? null,
      guarantors: customer.guarantors.map((guarantor) => ({
        ...guarantor,
        createdAt: guarantor.createdAt.toISOString(),
        updatedAt: guarantor.updatedAt.toISOString(),
      })),
    };
  }
}
