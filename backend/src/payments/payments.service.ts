import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ContractStatus } from '../common/enums';
import { paginate, type Paginated } from '../common/pagination';
import { Contract, Payment } from '../database/entities';
import { applyFifo, outstandingOf, toAmount, toPaisa } from '../formulas';
import { SettingsService } from '../settings/settings.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import {
  applyPaymentFilters,
  applyPaymentSort,
  CONTRACT_ALIAS,
  CUSTOMER_ALIAS,
  PAYMENT_ALIAS,
  PRODUCT_ALIAS,
  RECORDER_ALIAS,
} from './payment.query';
import {
  toAuditSnapshot,
  toPaymentResponse,
  type CollectableContract,
  type PaymentResponse,
  type PaymentWriteResult,
} from './payment.mapper';

/** Contract 7 reads as SPS-0007, matching the printed agreement. */
function reference(id: number): string {
  return `SPS-${String(id).padStart(4, '0')}`;
}

/** Module 6 (SRS §4.6). Collection against a contract, inside one transaction. */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ----------------------------------------------------------- reads --

  /** FR-PAY-01 */
  async findAll(query: ListPaymentsDto): Promise<Paginated<PaymentResponse>> {
    const qb = this.payments
      .createQueryBuilder(PAYMENT_ALIAS)
      // FR-PAY-09: a void is a soft delete, and it must stay in the register.
      // TypeORM would exclude it by default, so this is deliberate.
      .withDeleted()
      .innerJoinAndSelect(`${PAYMENT_ALIAS}.contract`, CONTRACT_ALIAS)
      .innerJoinAndSelect(`${CONTRACT_ALIAS}.customer`, CUSTOMER_ALIAS)
      .innerJoinAndSelect(`${CONTRACT_ALIAS}.product`, PRODUCT_ALIAS)
      .leftJoinAndSelect(`${PAYMENT_ALIAS}.recordedBy`, RECORDER_ALIAS);

    applyPaymentFilters(qb, query);
    applyPaymentSort(qb, query);

    const [rows, total] = await qb
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();

    return paginate(
      rows.map(toPaymentResponse),
      total,
      query.page,
      query.page_size,
    );
  }

  async findOne(id: number): Promise<PaymentResponse> {
    return toPaymentResponse(await this.loadOrFail(id));
  }

  /**
   * FR-PAY-02 / FR-PAY-03. Every contract that can still take money, with the
   * figures the form needs already on it — the picker and the prefill in one
   * call, so selecting a contract costs no round trip.
   *
   * Two queries, never N+1: the contracts with their schedules, and one
   * grouped sum of payments. The FIFO walk (BR-13) then happens in memory.
   */
  async collectable(): Promise<CollectableContract[]> {
    const contracts = await this.contracts.find({
      where: { status: ContractStatus.active },
      relations: { customer: true, product: true, installments: true },
      order: { id: 'ASC' },
    });

    if (contracts.length === 0) return [];

    const paidByContract = await this.paidByContract(
      contracts.map((contract) => contract.id),
    );

    const today = new Date().toISOString().slice(0, 10);

    return (
      contracts
        .map((contract) => {
          const paid = paidByContract.get(contract.id) ?? 0;

          return {
            contract,
            paid,
            outstanding: outstandingOf(toPaisa(contract.financed_amount), paid),
          };
        })
        // FR-PAY-02: an active contract with nothing left to collect is not
        // offered. BR-12 should have completed it, but a contract that reached
        // zero another way must not appear either.
        .filter((row) => row.outstanding > 0)
        .map(({ contract, paid, outstanding }) => {
          const { next } = applyFifo(contract.installments ?? [], paid);

          return {
            contract_id: contract.id,
            reference: reference(contract.id),
            customer_id: contract.customer_id,
            customer_name: contract.customer?.full_name ?? '',
            customer_cnic: contract.customer?.cnic_number ?? '',
            customer_mobile: contract.customer?.mobile_number ?? '',
            product_name: contract.product?.name ?? '',
            monthly_installment: contract.monthly_installment,
            financed_amount: contract.financed_amount,
            paid_amount: toAmount(paid),
            outstanding_amount: toAmount(outstanding),
            next_seq: next?.seq ?? null,
            next_due_date: next?.due_date ?? null,
            next_amount: next ? toAmount(next.outstanding) : null,
            past_due: next !== null && next.due_date < today,
          };
        })
    );
  }

  // ---------------------------------------------------------- writes --

  /**
   * FR-PAY-07-v2. The insert, the balance derivation and any BR-12 transition
   * happen in **one transaction**. There is no stored balance column, so the
   * only thing that can drift is the contract's status — and it cannot, because
   * it is decided from the same rows the insert just joined.
   */
  async create(
    dto: CreatePaymentDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<PaymentWriteResult> {
    const contract = await this.contractOrFail(dto.contract_id);

    if (contract.status !== ContractStatus.active) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Contract ${reference(contract.id)} is ${contract.status}, so it cannot take a payment.`,
      });
    }

    const amount = toPaisa(dto.amount);
    const financed = toPaisa(contract.financed_amount);

    const paidBefore = await this.paidPaisa(contract.id);
    const outstandingBefore = outstandingOf(financed, paidBefore);

    if (outstandingBefore === 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Contract ${reference(contract.id)} is fully paid.`,
      });
    }

    await this.assertAmountAllowed(amount, outstandingBefore, dto);

    let saved!: Payment;

    await this.dataSource.transaction(async (manager) => {
      saved = await manager.save(
        manager.create(Payment, {
          contract_id: contract.id,
          amount: toAmount(amount),
          payment_date: dto.payment_date.slice(0, 10),
          method: dto.method,
          note: dto.note ?? null,
          recorded_by: actor.id,
        }),
      );

      // Re-read inside the transaction rather than adding to the figure above:
      // a concurrent collection would make arithmetic on a stale total wrong,
      // and this is the money.
      const paidAfter = await this.paidPaisa(contract.id, manager);

      if (outstandingOf(financed, paidAfter) === 0) {
        await manager.update(
          Contract,
          { id: contract.id },
          { status: ContractStatus.completed },
        );
      }
    });

    const paidAfter = await this.paidPaisa(contract.id);
    const outstandingAfter = outstandingOf(financed, paidAfter);
    const completed = outstandingAfter === 0;

    const payment = toPaymentResponse(await this.loadOrFail(saved.id));

    await this.audit.record({
      actor_id: actor.id,
      entity: 'payment',
      entity_id: String(saved.id),
      action: 'create',
      after: toAuditSnapshot(payment),
      ip,
    });

    return {
      payment,
      contract: {
        id: contract.id,
        status: completed ? ContractStatus.completed : contract.status,
        paid_amount: toAmount(paidAfter),
        outstanding_amount: toAmount(outstandingAfter),
        status_changed: completed,
      },
    };
  }

  /**
   * FR-PAY-08-v2. Voiding, not deleting. The row stays, the reason is recorded,
   * the balance is re-derived, and a `completed` contract goes back to `active`
   * if the void reopened a balance — all in one transaction.
   *
   * v1's clamp-and-restore inflation bug is structurally impossible here
   * because no balance is stored to be clamped.
   */
  async void(
    id: number,
    dto: VoidPaymentDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<PaymentWriteResult> {
    const payment = await this.loadOrFail(id);

    if (payment.deleted_at !== null) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'This payment is already voided.',
        voided_at: payment.deleted_at.toISOString(),
      });
    }

    const before = toPaymentResponse(payment);
    const contract = await this.contractOrFail(payment.contract_id);
    const financed = toPaisa(contract.financed_amount);

    await this.dataSource.transaction(async (manager) => {
      // The reason must be on the row before it disappears from default reads,
      // so it is written first and the soft delete follows.
      await manager.update(Payment, { id }, { void_reason: dto.void_reason });
      await manager.softDelete(Payment, { id });

      const paidAfter = await this.paidPaisa(contract.id, manager);

      // BR-12 in reverse: a void can reopen a balance on a completed plan.
      if (
        contract.status === ContractStatus.completed &&
        outstandingOf(financed, paidAfter) > 0
      ) {
        await manager.update(
          Contract,
          { id: contract.id },
          { status: ContractStatus.active },
        );
      }
    });

    const paidAfter = await this.paidPaisa(contract.id);
    const outstandingAfter = outstandingOf(financed, paidAfter);
    const reopened =
      contract.status === ContractStatus.completed && outstandingAfter > 0;

    const after = toPaymentResponse(await this.loadOrFail(id));

    await this.audit.record({
      actor_id: actor.id,
      entity: 'payment',
      entity_id: String(id),
      action: 'void',
      before: toAuditSnapshot(before),
      after: toAuditSnapshot(after),
      ip,
    });

    return {
      payment: after,
      contract: {
        id: contract.id,
        status: reopened ? ContractStatus.active : contract.status,
        paid_amount: toAmount(paidAfter),
        outstanding_amount: toAmount(outstandingAfter),
        status_changed: reopened,
      },
    };
  }

  // --------------------------------------------------------- helpers --

  /**
   * FR-PAY-06-v2. An amount above the outstanding balance is refused by
   * default, and the exact overage is named — "too much" is not something a
   * collector can act on at a counter.
   */
  private async assertAmountAllowed(
    amount: number,
    outstanding: number,
    dto: CreatePaymentDto,
  ): Promise<void> {
    if (amount <= outstanding) return;

    const overage = amount - outstanding;

    if (!(await this.overpaymentAllowed())) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `This is ${toAmount(overage)} more than the ${toAmount(outstanding)} outstanding. Collect the balance, or turn on overpayment in settings.`,
        field_errors: { amount: `At most ${toAmount(outstanding)}` },
        outstanding_amount: toAmount(outstanding),
        overage_amount: toAmount(overage),
      });
    }

    if (dto.confirm_overpayment !== true) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `This is ${toAmount(overage)} more than the ${toAmount(outstanding)} outstanding. Confirm to accept the overpayment.`,
        outstanding_amount: toAmount(outstanding),
        overage_amount: toAmount(overage),
      });
    }
  }

  private overpaymentAllowed(): Promise<boolean> {
    return this.settings.get('allow_overpayment');
  }

  /** Total of non-voided payments, in paisa. The only definition of "paid". */
  private async paidPaisa(
    contract_id: number,
    manager?: {
      getRepository: (target: typeof Payment) => Repository<Payment>;
    },
  ): Promise<number> {
    const repository = manager ? manager.getRepository(Payment) : this.payments;

    const rows = await repository.find({
      where: { contract_id, deleted_at: IsNull() },
      select: { amount: true },
    });

    return rows.reduce((sum, row) => sum + toPaisa(row.amount), 0);
  }

  /** One grouped read for the whole picker, so the list is never N+1. */
  private async paidByContract(ids: number[]): Promise<Map<number, number>> {
    const rows = await this.payments.find({
      where: { contract_id: In(ids), deleted_at: IsNull() },
      select: { contract_id: true, amount: true },
    });

    const totals = new Map<number, number>();

    for (const row of rows) {
      totals.set(
        row.contract_id,
        (totals.get(row.contract_id) ?? 0) + toPaisa(row.amount),
      );
    }

    return totals;
  }

  /** `withDeleted`, because a voided payment is still addressable (FR-PAY-09). */
  private async loadOrFail(id: number): Promise<Payment> {
    const payment = await this.payments.findOne({
      where: { id },
      withDeleted: true,
      relations: {
        contract: { customer: true, product: true },
        recordedBy: true,
      },
    });

    if (!payment) throw new NotFoundException(`Payment ${id} not found`);

    return payment;
  }

  private async contractOrFail(id: number): Promise<Contract> {
    const contract = await this.contracts.findOne({ where: { id } });

    if (!contract) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Contract "${id}" does not exist`,
        field_errors: { contract_id: 'Choose a contract from the list' },
      });
    }

    return contract;
  }
}
