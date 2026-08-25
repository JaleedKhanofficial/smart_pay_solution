import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { paginate, type Paginated } from '../common/pagination';
import { Contract, Customer, Guarantor } from '../database/entities';
import {
  CustomerUploadsService,
  type CustomerUploads,
  type ResolvedFiles,
} from './customer-uploads.service';
import {
  toAuditSnapshot,
  toCustomerResponse,
  type CustomerResponse,
} from './customer.mapper';
import {
  applyCustomerFilters,
  applyCustomerSort,
  CUSTOMER_ALIAS,
} from './customer.query';
import { CreateCustomerDto } from './dto/create-customer.dto';
import type { GuarantorDto } from './dto/guarantor.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/**
 * Module 2 (SRS §4.2). Business rules and transaction boundaries live here;
 * the three CNIC images belong to CustomerUploadsService, filtering to
 * customer.query.ts, and the response shape to customer.mapper.ts.
 *
 * Soft-deleted customers are invisible to every query below without a filter,
 * because `deleted_at` is a @DeleteDateColumn on the entity.
 */
@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    private readonly dataSource: DataSource,
    private readonly uploads: CustomerUploadsService,
    private readonly audit: AuditService,
  ) {}

  /** FR-CUS-02, FR-CUS-03-v2, FR-CUS-06 — record and images save atomically. */
  async create(
    body: CreateCustomerDto,
    uploads: CustomerUploads,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<CustomerResponse> {
    await this.assertCnicIsFree(body.cnic_number);
    this.assertGuarantorPositions(body.guarantors);
    this.uploads.validateAll(uploads);

    const ledger = this.uploads.newLedger();

    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const files = await this.uploads.forCreate(
          manager,
          body,
          uploads,
          ledger,
          actor.id,
        );

        const customer = manager.create(Customer, {
          full_name: body.full_name,
          father_husband_name: body.father_husband_name,
          cnic_number: body.cnic_number,
          mobile_number: body.mobile_number,
          address: body.address,
          occupation: body.occupation,
          monthly_income: body.monthly_income.toFixed(2),
          cnic_file_front_id: files.customerFrontFileId,
          cnic_file_back_id: files.customerBackFileId,
        });

        const saved = await manager.save(customer);

        const inserted = await manager.insert(
          Guarantor,
          body.guarantors.map((guarantor) => ({
            customer_id: saved.id,
            ...this.guarantorFields(guarantor, files),
          })),
        );

        // The images were written before the customer had an id, so ownership
        // is stamped now — the identifiers come back in the order inserted.
        const guarantorIds = new Map<number, number>();

        body.guarantors.forEach((guarantor, index) => {
          const id = (
            inserted.identifiers[index] as { id?: number } | undefined
          )?.id;

          if (id !== undefined) guarantorIds.set(guarantor.position, id);
        });

        await this.uploads.assignOwners(manager, files, saved.id, guarantorIds);

        return saved.id;
      });

      const created = await this.findOne(id);

      await this.audit.record({
        actor_id: actor.id,
        entity: 'customer',
        entity_id: String(id),
        action: 'create',
        after: toAuditSnapshot(created),
        ip,
      });

      return created;
    } catch (error) {
      await this.uploads.discard(ledger);

      throw error;
    }
  }

  /** FR-CUS-01: paginated, searchable, filterable and sortable. */
  async findAll(query: ListCustomersDto): Promise<Paginated<CustomerResponse>> {
    const qb = this.customers
      .createQueryBuilder(CUSTOMER_ALIAS)
      .leftJoinAndSelect(`${CUSTOMER_ALIAS}.guarantors`, 'guarantor');

    applyCustomerFilters(qb, query);
    applyCustomerSort(qb, query);

    const [rows, total] = await qb
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();

    return paginate(
      rows.map(toCustomerResponse),
      total,
      query.page,
      query.page_size,
    );
  }

  /** Distinct occupations across live customers, for the filter dropdown. */
  async occupations(): Promise<string[]> {
    const rows = await this.customers
      .createQueryBuilder(CUSTOMER_ALIAS)
      .select(`${CUSTOMER_ALIAS}.occupation`, 'occupation')
      .distinct(true)
      .orderBy('occupation', 'ASC')
      .getRawMany<{ occupation: string }>();

    return rows.map((row) => row.occupation);
  }

  async findOne(id: number): Promise<CustomerResponse> {
    return toCustomerResponse(await this.loadOrFail(id));
  }

  /** FR-CUS-07 */
  async update(
    id: number,
    dto: UpdateCustomerDto,
    uploads: CustomerUploads,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<CustomerResponse> {
    const before = await this.loadOrFail(id);

    if (dto.cnic_number && dto.cnic_number !== before.cnic_number) {
      await this.assertCnicIsFree(dto.cnic_number, id);
    }

    if (dto.guarantors) this.assertGuarantorPositions(dto.guarantors);

    this.uploads.validateAll(uploads);

    const ledger = this.uploads.newLedger();

    try {
      await this.dataSource.transaction(async (manager) => {
        const files = await this.uploads.forUpdate(
          manager,
          before,
          dto,
          uploads,
          ledger,
          actor.id,
        );

        const guarantorIds = await this.saveGuarantors(
          manager,
          id,
          before,
          dto,
          files,
        );

        await this.uploads.assignOwners(manager, files, id, guarantorIds);

        await manager.update(
          Customer,
          { id },
          {
            full_name: dto.full_name,
            father_husband_name: dto.father_husband_name,
            cnic_number: dto.cnic_number,
            mobile_number: dto.mobile_number,
            address: dto.address,
            occupation: dto.occupation,
            monthly_income: dto.monthly_income?.toFixed(2),
            cnic_file_front_id: files.customerFrontFileId,
            cnic_file_back_id: files.customerBackFileId,
          },
        );
      });

      await this.uploads.removeReplaced(ledger);

      const after = await this.findOne(id);

      await this.audit.record({
        actor_id: actor.id,
        entity: 'customer',
        entity_id: String(id),
        action: 'update',
        before: toAuditSnapshot(toCustomerResponse(before)),
        after: toAuditSnapshot(after),
        ip,
      });

      return after;
    } catch (error) {
      await this.uploads.discard(ledger);

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
    const before = await this.loadOrFail(id);

    const blocking = await this.contracts.find({
      where: { customer_id: id },
      select: { id: true, status: true, start_date: true },
    });

    if (blocking.length) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message:
          'This customer still has contracts. Delete or reassign them first.',
        blocking_contracts: blocking,
      });
    }

    await this.customers.softDelete({ id });

    await this.audit.record({
      actor_id: actor.id,
      entity: 'customer',
      entity_id: String(id),
      action: 'soft_delete',
      before: toAuditSnapshot(toCustomerResponse(before)),
      ip,
    });
  }

  private async loadOrFail(id: number): Promise<Customer> {
    const customer = await this.customers.findOne({
      where: { id },
      relations: { guarantors: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" was not found`);
    }

    return customer;
  }

  /**
   * Writes the submitted guarantors, and carries a replaced image across for a
   * position whose details were not resubmitted.
   *
   * Returns position → guarantor id, which is what lets the file rows be
   * stamped with their owner afterwards.
   */
  private async saveGuarantors(
    manager: EntityManager,
    customer_id: number,
    before: Customer,
    dto: UpdateCustomerDto,
    files: ResolvedFiles,
  ): Promise<Map<number, number>> {
    const ids = new Map<number, number>();

    for (const existing of before.guarantors) {
      ids.set(existing.position, existing.id);
    }

    if (dto.guarantors) {
      for (const guarantor of dto.guarantors) {
        const fields = this.guarantorFields(guarantor, files);
        const existing = before.guarantors.find(
          (row) => row.position === guarantor.position,
        );

        if (existing) {
          await manager.update(Guarantor, { id: existing.id }, fields);
        } else {
          const inserted = await manager.insert(Guarantor, {
            customer_id,
            ...fields,
          });
          const id = (inserted.identifiers[0] as { id?: number } | undefined)
            ?.id;

          if (id !== undefined) ids.set(guarantor.position, id);
        }
      }

      return ids;
    }

    // Images can be replaced or cleared without resubmitting the details.
    for (const existing of before.guarantors) {
      const pair = files.guarantorFileIds.get(existing.position);

      if (!pair) continue;

      const unchanged =
        pair.front === existing.cnic_file_front_id &&
        pair.back === existing.cnic_file_back_id;

      if (unchanged) continue;

      await manager.update(
        Guarantor,
        { id: existing.id },
        { cnic_file_front_id: pair.front, cnic_file_back_id: pair.back },
      );
    }

    return ids;
  }

  private guarantorFields(guarantor: GuarantorDto, files: ResolvedFiles) {
    return {
      position: guarantor.position,
      full_name: guarantor.full_name,
      father_name: guarantor.father_name,
      relationship: guarantor.relationship,
      cnic_number: guarantor.cnic_number,
      mobile_number: guarantor.mobile_number,
      address: guarantor.address,
      cnic_file_front_id:
        files.guarantorFileIds.get(guarantor.position)?.front ?? null,
      cnic_file_back_id:
        files.guarantorFileIds.get(guarantor.position)?.back ?? null,
    };
  }

  /**
   * Guarantor 1 is required, guarantor 2 is optional — a deliberate relaxation
   * of FR-CUS-03-v2 (SRS §2.7 deviation 4). A repeated position would otherwise
   * reach the unique index and surface as a 500.
   */
  private assertGuarantorPositions(guarantors: GuarantorDto[]): void {
    const positions = guarantors.map((row) => row.position);

    if (positions.length !== new Set(positions).size) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'each guarantor must have a different position',
        field_errors: {
          guarantors: 'Guarantor 1 and guarantor 2 cannot share a position',
        },
      });
    }

    if (!positions.includes(1)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'guarantor 1 is required',
        field_errors: { guarantors: 'Guarantor 1 is required' },
      });
    }
  }

  /**
   * Checked here so the client gets a field-level 409 (FR-CUS-08); the partial
   * unique index `uq_customers_cnic_live` remains the real guard.
   */
  private async assertCnicIsFree(
    cnic_number: string,
    exceptId?: number,
  ): Promise<void> {
    const clash = await this.customers.existsBy({
      cnic_number,
      ...(exceptId ? { id: Not(exceptId) } : {}),
    });

    if (clash) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `A customer with CNIC "${cnic_number}" already exists`,
        field_errors: { cnic_number: 'This CNIC is already registered' },
      });
    }
  }
}
