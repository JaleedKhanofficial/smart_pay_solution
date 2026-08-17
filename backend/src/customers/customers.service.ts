import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Customer } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateCustomerDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<Customer> {
    await this.assertCnicIsFree(dto.cnicNumber);

    const customer = await this.prisma.customer.create({
      data: { ...dto, monthlyIncome: new Prisma.Decimal(dto.monthlyIncome) },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'customer',
      entityId: customer.id,
      action: 'create',
      after: this.forAudit(customer),
      ip,
    });

    return customer;
  }

  /** FR-CUS-01: newest first, paginated, searchable by name, CNIC or mobile. */
  async findAll(query: ListCustomersDto): Promise<Paginated<Customer>> {
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

  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { guarantors: { orderBy: { position: 'asc' } } },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" was not found`);
    }

    return customer;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<Customer> {
    const before = await this.findOne(id);

    if (dto.cnicNumber && dto.cnicNumber !== before.cnicNumber) {
      await this.assertCnicIsFree(dto.cnicNumber, id);
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        monthlyIncome:
          dto.monthlyIncome === undefined
            ? undefined
            : new Prisma.Decimal(dto.monthlyIncome),
      },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'customer',
      entityId: id,
      action: 'update',
      before: this.forAudit(before),
      after: this.forAudit(customer),
      ip,
    });

    return customer;
  }

  /**
   * FR-CUS-09-v2: soft delete, blocked with 409 and the blocking contract list
   * while the customer still has live contracts.
   */
  async remove(
    id: string,
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
      entityId: id,
      action: 'soft_delete',
      before: this.forAudit(before),
      ip,
    });
  }

  /**
   * Checked in the service so the client gets a field-level 409 (FR-CUS-08);
   * the partial unique index `uq_customers_cnic_live` remains the real guard.
   */
  private async assertCnicIsFree(
    cnicNumber: string,
    exceptId?: string,
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
  private forAudit(customer: Customer): Prisma.InputJsonValue {
    return {
      ...customer,
      monthlyIncome: customer.monthlyIncome.toString(),
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      deletedAt: customer.deletedAt?.toISOString() ?? null,
    };
  }
}
