import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ContractStatus, ProductStatus, Role } from '../common/enums';
import { paginate, type Paginated } from '../common/pagination';
import {
  Contract,
  Customer,
  Installment,
  Payment,
  Product,
} from '../database/entities';
import {
  buildLedger,
  priceContract,
  toAmount,
  toPaisa,
  type LossAllocation,
} from '../formulas';
import { SettingsService } from '../settings/settings.service';
import { FundingService } from './funding.service';
import {
  toAuditSnapshot,
  toContractDetailResponse,
  toContractResponse,
  type ContractDetailResponse,
  type ContractResponse,
} from './contract.mapper';
import {
  applyContractFilters,
  applyContractSort,
  CONTRACT_ALIAS,
  CUSTOMER_ALIAS,
  PRODUCT_ALIAS,
} from './contract.query';
import { toCustomerResponse } from '../customers/customer.mapper';
import { toLedgerResponse, type LedgerResponse } from './ledger.mapper';
import type { InvoiceResponse } from './invoice.mapper';
import {
  CreateContractDto,
  PreviewContractDto,
} from './dto/create-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

/** FR-CON-04-v2: a client figure may differ by up to a rupee before it is flagged. */
const CORRECTION_TOLERANCE_PAISA = 100;

/** The figures the browser preview is allowed to send back for checking. */
const CHECKED_FIGURES = [
  'markup_amount',
  'net_amount',
  'financed_amount',
  'monthly_installment',
  'end_date',
] as const;

export type ContractWriteResult = {
  contract: ContractDetailResponse;
  /** Named fields where the browser's arithmetic disagreed with the server's. */
  corrections: string[];
};

/**
 * Module 4 (SRS §4.4). The server is authoritative: it recomputes markup, net,
 * financed, the installment schedule and the end date from the raw terms and
 * persists **its own** figures (FR-CON-04-v2), which is what makes v1's
 * trust-the-browser defect structurally impossible.
 *
 * There is no stored balance. Outstanding is always
 * `financed_amount − Σ non-voided payments`, derived wherever it is needed.
 */
@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly settingsService: SettingsService,
    private readonly funding: FundingService,
  ) {}

  /** FR-CON-03-v2, FR-CON-05-v2: priced, scheduled and activated in one transaction. */
  async create(
    body: CreateContractDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<ContractWriteResult> {
    await this.assertCustomerExists(body.customer_id);
    await this.assertProductIsSelectable(body.product_id);
    await this.assertPlanMonthsAllowed(body.plan_months);

    const priced = this.price(body);
    const corrections = this.compare(priced, body.preview);

    // FR-CON-13. Every reason a funding set could be refused is checked here,
    // before anything is written: an investor short of funds, an inactive one,
    // a total above the cost price, an override with no reason.
    const fundings = await this.funding.prepare(
      body.fundings ?? [],
      priced.cost_price,
    );

    const id = await this.dataSource.transaction(async (manager) => {
      const contract = manager.create(Contract, {
        customer_id: body.customer_id,
        product_id: body.product_id,
        cost_price: priced.cost_price,
        sale_price: priced.sale_price,
        markup_pct: priced.markup_pct,
        markup_amount: priced.markup_amount,
        net_amount: priced.net_amount,
        down_payment: priced.down_payment,
        financed_amount: priced.financed_amount,
        monthly_installment: priced.monthly_installment,
        plan_months: priced.plan_months,
        product_condition: body.product_condition,
        start_date: priced.start_date,
        end_date: priced.end_date,
        status: ContractStatus.active,
        notes: body.notes ?? null,
      });

      const saved = await manager.save(contract);

      await this.writeSchedule(manager, saved.id, priced.schedule);

      // FR-CON-11/13. Validated before the transaction opened, so this only
      // writes — an invalid allocation never leaves a half-activated deal.
      await this.funding.attach(manager, saved.id, fundings, actor);

      return saved.id;
    });

    const created = await this.findOne(id, actor);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'contract',
      entity_id: String(id),
      action: 'create',
      after: toAuditSnapshot(created),
      ip,
    });

    return { contract: created, corrections };
  }

  /**
   * FR-CON-04-v2. The live plan preview, priced by the **same code that will
   * persist it**, so the figures on screen and the figures stored cannot
   * disagree — a stronger guarantee than sharing a package between two builds,
   * because it is one execution rather than two copies (SRS §2.7 item 13).
   *
   * Nothing is written and nothing is looked up: this is arithmetic only.
   */
  preview(body: PreviewContractDto): ReturnType<typeof priceContract> {
    return this.price(body);
  }

  /**
   * FR-CON-01. No actor needed: the register carries no admin-only figure now
   * that cost and sale are the same number (SRS §2.7 item 15). `findOne` still
   * takes one, because the detail response gates `house_funded_amount`.
   */
  async findAll(query: ListContractsDto): Promise<Paginated<ContractResponse>> {
    const qb = this.contracts
      .createQueryBuilder(CONTRACT_ALIAS)
      .innerJoinAndSelect(`${CONTRACT_ALIAS}.customer`, CUSTOMER_ALIAS)
      .innerJoinAndSelect(`${CONTRACT_ALIAS}.product`, PRODUCT_ALIAS);

    applyContractFilters(qb, query);
    applyContractSort(qb, query);

    const [rows, total] = await qb
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();

    return paginate(
      rows.map(toContractResponse),
      total,
      query.page,
      query.page_size,
    );
  }

  async findOne(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<ContractDetailResponse> {
    const contract = await this.loadOrFail(id);

    const include_cost = this.maySeeCost(actor);

    return toContractDetailResponse(contract, {
      include_cost,
      // BR-14. Only read where it will be shown — an operator's response
      // carries no cost figure at all, so there is nothing to compute.
      house_funded: include_cost
        ? await this.funding.houseFundedFor(contract.id, contract.cost_price)
        : null,
    });
  }

  /**
   * FR-REC-01-v2 … FR-REC-06. The recovery ledger, derived from the schedule
   * and the payments table — never stored, so it cannot disagree with the
   * money. This is the fix for v1 §9.2, where the workbook was hand-typed.
   *
   * Voided payments are excluded here rather than inside the formula, which
   * has no notion of a void: what it grades is money that arrived.
   */
  async ledger(id: number): Promise<LedgerResponse> {
    const contract = await this.loadOrFail(id);

    const payments = await this.payments.find({
      where: { contract_id: id },
      select: { id: true, amount: true, payment_date: true },
    });

    const { punctuality_thresholds, loyalty } =
      await this.settingsService.getMany(['punctuality_thresholds', 'loyalty']);

    const report = buildLedger(
      contract.installments ?? [],
      payments,
      {
        net_amount: contract.net_amount,
        down_payment: contract.down_payment,
        financed_amount: contract.financed_amount,
      },
      { thresholds: punctuality_thresholds, loyalty },
    );

    return toLedgerResponse(toContractResponse(contract), report);
  }

  /**
   * FR-INV-01..05, FR-INV-07. The printed agreement in one payload: the deal,
   * its schedule, the customer with both guarantors, and the letterhead.
   *
   * The customer is loaded with `withDeleted`, because a contract outlives the
   * customer record being recycled and the agreement must still print.
   */
  async invoice(id: number): Promise<InvoiceResponse> {
    const contract = await this.loadOrFail(id);

    const customer = await this.customers.findOne({
      where: { id: contract.customer_id },
      relations: { guarantors: true },
      withDeleted: true,
    });

    if (!customer) {
      throw new NotFoundException(
        `Contract ${id} names customer ${contract.customer_id}, which no longer exists`,
      );
    }

    return {
      // NFR-15 does not apply to the operator printing this: cost equals the
      // sale price now (§2.7 item 15). The document itself prints neither.
      contract: toContractDetailResponse(contract, {
        include_cost: true,
        house_funded: await this.funding.houseFundedFor(
          contract.id,
          contract.cost_price,
        ),
      }),
      customer: toCustomerResponse(customer),
      business: await this.settingsService.get('business_identity'),
      issued_at: new Date().toISOString(),
    };
  }

  /**
   * FR-CON-07-v2. Financial terms may be edited only while no non-voided
   * payment exists; the schedule is then regenerated. Once money has been
   * taken, only status, product condition and notes remain editable.
   */
  async update(
    id: number,
    dto: UpdateContractDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<ContractWriteResult> {
    const before = await this.loadOrFail(id);
    const paid = await this.paidPaisa(id);
    const locked = paid > 0;

    const wantsTermChange = this.touchesTerms(dto);

    if (wantsTermChange && locked) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message:
          'This contract has payments against it, so its financial terms are locked. Void the payments first, or edit only the status, condition and notes.',
        paid_amount: toAmount(paid),
      });
    }

    if (dto.status === ContractStatus.cancelled) {
      this.assertMayCancel(dto, actor, before, paid);
    }

    let corrections: string[] = [];
    let loss: LossAllocation | null = null;

    await this.dataSource.transaction(async (manager) => {
      if (wantsTermChange) {
        const priced = this.price({
          cost_price: dto.cost_price ?? Number(before.cost_price),
          sale_price: dto.sale_price ?? Number(before.sale_price),
          markup_pct: dto.markup_pct ?? Number(before.markup_pct),
          // An omitted override lets the percentage drive the amount again.
          markup_amount: dto.markup_amount,
          down_payment: dto.down_payment ?? Number(before.down_payment),
          plan_months: dto.plan_months ?? before.plan_months,
          product_condition: dto.product_condition ?? before.product_condition,
          start_date: dto.start_date ?? before.start_date,
        });

        corrections = this.compare(priced, dto.preview);

        await manager.update(
          Contract,
          { id },
          {
            customer_id: dto.customer_id,
            product_id: dto.product_id,
            cost_price: priced.cost_price,
            sale_price: priced.sale_price,
            markup_pct: priced.markup_pct,
            markup_amount: priced.markup_amount,
            net_amount: priced.net_amount,
            down_payment: priced.down_payment,
            financed_amount: priced.financed_amount,
            monthly_installment: priced.monthly_installment,
            plan_months: priced.plan_months,
            start_date: priced.start_date,
            end_date: priced.end_date,
          },
        );

        // FR-CON-05-v2: the plan is a consequence of the terms, so it is
        // rebuilt rather than patched.
        await manager.delete(Installment, { contract_id: id });
        await this.writeSchedule(manager, id, priced.schedule);
      }

      const writesOff =
        dto.status === ContractStatus.cancelled &&
        (await this.outstandingPaisa(id, paid)) > 0;

      await manager.update(
        Contract,
        { id },
        {
          product_condition: dto.product_condition,
          notes: dto.notes,
          status: dto.status,
          ...(dto.status === ContractStatus.cancelled
            ? { write_off: writesOff }
            : {}),
        },
      );

      // BR-20. Writing off the customer's balance ends the stream the funders'
      // capital was coming back through, so what has not returned never will.
      // Written in the same transaction as the cancellation: a cancelled
      // contract whose losses were not allocated would leave every funder's
      // balance overstated, with nothing on the ledger to explain it.
      if (writesOff) {
        loss = await this.funding.settleLosses(
          manager,
          id,
          actor,
          `Contract ${id} cancelled and written off: ${dto.cancel_reason ?? 'no reason recorded'}`,
        );
      }
    });

    const after = await this.findOne(id, actor);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'contract',
      entity_id: String(id),
      action: dto.status === ContractStatus.cancelled ? 'cancel' : 'update',
      before: toAuditSnapshot(toContractResponse(before)),
      // BR-20 requires an audit row for the allocation. It rides on the
      // cancellation's own entry rather than a second one: they are one act,
      // and splitting them would let a reader find a write-off with no
      // cancellation next to it.
      after: { ...toAuditSnapshot(after), ...(loss ? { loss } : {}) },
      ip,
    });

    return { contract: after, corrections };
  }

  /** FR-CON-09: soft delete, blocked while any non-voided payment exists. */
  async remove(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const before = await this.loadOrFail(id);
    const paid = await this.paidPaisa(id);

    if (paid > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message:
          'This contract has payments against it. Void them first, or cancel the contract instead of deleting it.',
        paid_amount: toAmount(paid),
      });
    }

    await this.dataSource.transaction(async (manager) => {
      // The plan has no meaning without the contract, and nothing references
      // an installment, so it goes rather than lingering as an orphan.
      await manager.delete(Installment, { contract_id: id });
      await manager.softDelete(Contract, { id });
    });

    await this.audit.record({
      actor_id: actor.id,
      entity: 'contract',
      entity_id: String(id),
      action: 'soft_delete',
      before: toAuditSnapshot(toContractResponse(before)),
      ip,
    });
  }

  // ---------------------------------------------------------------- pricing --

  /** Everything derived comes from the shared formula package (SRS §2.5). */
  private price(terms: {
    cost_price: number;
    sale_price: number;
    markup_pct: number;
    markup_amount?: number;
    down_payment: number;
    plan_months: number;
    product_condition: unknown;
    start_date: string;
  }) {
    try {
      return priceContract({
        cost_price: terms.cost_price,
        sale_price: terms.sale_price,
        markup_pct: terms.markup_pct,
        markup_amount: terms.markup_amount,
        down_payment: terms.down_payment,
        plan_months: terms.plan_months,
        start_date: terms.start_date.slice(0, 10),
      });
    } catch (error) {
      // The formula package throws plain Errors; the client needs a 400 with
      // the reason rather than a 500.
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          error instanceof Error ? error.message : 'Invalid contract terms',
      });
    }
  }

  /**
   * FR-CON-04-v2. The browser's preview is checked, never trusted: a
   * disagreement beyond a rupee is reported so the screen can say the figures
   * were corrected, and the server's numbers are the ones stored either way.
   */
  private compare(
    priced: ReturnType<typeof priceContract>,
    preview: Record<string, number | string> | undefined,
  ): string[] {
    if (!preview) return [];

    const corrections: string[] = [];

    for (const field of CHECKED_FIGURES) {
      const claimed = preview[field];

      if (claimed === undefined || claimed === null) continue;

      if (field === 'end_date') {
        if (String(claimed).slice(0, 10) !== priced.end_date) {
          corrections.push(field);
        }

        continue;
      }

      try {
        const difference = Math.abs(toPaisa(claimed) - toPaisa(priced[field]));

        if (difference > CORRECTION_TOLERANCE_PAISA) corrections.push(field);
      } catch {
        // An unparseable preview figure is a disagreement by definition.
        corrections.push(field);
      }
    }

    return corrections;
  }

  private async writeSchedule(
    manager: EntityManager,
    contract_id: number,
    schedule: ReturnType<typeof priceContract>['schedule'],
  ): Promise<void> {
    if (schedule.length === 0) return;

    await manager.insert(
      Installment,
      schedule.map((row) => ({
        contract_id,
        seq: row.seq,
        due_date: row.due_date,
        amount: row.amount,
      })),
    );
  }

  // ----------------------------------------------------------------- guards --

  private touchesTerms(dto: UpdateContractDto): boolean {
    return (
      dto.cost_price !== undefined ||
      dto.sale_price !== undefined ||
      dto.markup_pct !== undefined ||
      dto.markup_amount !== undefined ||
      dto.down_payment !== undefined ||
      dto.plan_months !== undefined ||
      dto.start_date !== undefined ||
      dto.customer_id !== undefined ||
      dto.product_id !== undefined
    );
  }

  /**
   * FR-CON-08-v2. Cancelling is an admin action needing a reason, and is
   * blocked while there is still a balance unless the admin accepts a write-off.
   */
  private assertMayCancel(
    dto: UpdateContractDto,
    actor: AuthenticatedUser,
    before: Contract,
    paid: number,
  ): void {
    if (actor.role !== Role.admin) {
      throw new ForbiddenException('Only an admin can cancel a contract');
    }

    if (!dto.cancel_reason) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'A reason is required to cancel a contract',
        field_errors: { cancel_reason: 'Say why this contract is cancelled' },
      });
    }

    const outstanding = toPaisa(before.financed_amount) - paid;

    if (outstanding > 0 && !before.write_off && dto.write_off !== true) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `This contract still has ${toAmount(outstanding)} outstanding. Confirm a write-off to cancel it.`,
        outstanding_amount: toAmount(outstanding),
      });
    }
  }

  private async assertCustomerExists(customer_id: number): Promise<void> {
    if (await this.customers.existsBy({ id: customer_id })) return;

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: `Customer "${customer_id}" does not exist`,
      field_errors: { customer_id: 'Choose a customer from the list' },
    });
  }

  /** FR-PRD-05: only an Active product can be put on a new contract. */
  private async assertProductIsSelectable(product_id: number): Promise<void> {
    const product = await this.products.findOne({ where: { id: product_id } });

    if (!product) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Product "${product_id}" does not exist`,
        field_errors: { product_id: 'Choose a product from the list' },
      });
    }

    if (product.status !== ProductStatus.Active) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `"${product.name}" is inactive and cannot be put on a new contract`,
        field_errors: { product_id: 'This product is inactive' },
      });
    }
  }

  /** FR-SET-01: the plan range is a setting, not a constant. */
  private async assertPlanMonthsAllowed(plan_months: number): Promise<void> {
    const { plan_months_min: min, plan_months_max: max } =
      await this.settingsService.getMany([
        'plan_months_min',
        'plan_months_max',
      ]);

    if (plan_months < min || plan_months > max) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Plan months must be between ${min} and ${max}`,
        field_errors: { plan_months: `Between ${min} and ${max} months` },
      });
    }
  }

  // ------------------------------------------------------------------ reads --

  private async loadOrFail(id: number): Promise<Contract> {
    const contract = await this.contracts.findOne({
      where: { id },
      relations: { customer: true, product: true, installments: true },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with id "${id}" was not found`);
    }

    return contract;
  }

  /** The money, from the payments table alone — there is no stored balance. */
  private async paidPaisa(contract_id: number): Promise<number> {
    const row = await this.payments
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.contract_id = :contract_id', { contract_id })
      .andWhere('payment.deleted_at IS NULL')
      .getRawOne<{ total: string }>();

    return toPaisa(row?.total ?? '0');
  }

  private async outstandingPaisa(
    contract_id: number,
    paid: number,
  ): Promise<number> {
    const contract = await this.contracts.findOne({
      where: { id: contract_id },
      select: { financed_amount: true },
    });

    return contract ? toPaisa(contract.financed_amount) - paid : 0;
  }

  /** NFR-15: cost price is the basis for investor capital, so admin-only. */
  private maySeeCost(actor: AuthenticatedUser): boolean {
    return actor.role === Role.admin;
  }
}
