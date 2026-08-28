import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SnapshotKind } from '../common/enums';
import { paginate, type Paginated } from '../common/pagination';
import { Contract, LedgerSnapshot, Payment } from '../database/entities';
import { buildLedger, toAmount, toPaisa } from '../formulas';
import { SettingsService } from '../settings/settings.service';
import { ListRecoveryDto } from './dto/list-recovery.dto';

/** FR-REC-01-v2. One contract, seen through its recovery health. */
export type RecoveryRow = {
  contract_id: number;
  reference: string;
  customer_id: number;
  customer_name: string;
  customer_cnic: string;
  customer_mobile: string;
  product_name: string;
  status: string;
  financed_amount: string;
  paid: string;
  outstanding: string;
  recovered_pct: string;
  completed_installments: number;
  plan_months: number;
  /** Positive is lag, negative is advance, netted across completed rows. */
  net_days: number;
  tier_key: string;
  tier_label: string;
  /** At least one installment fell due before today and is not covered. */
  past_due: boolean;
};

/** FR-REC-01-v2. The banner above the register. */
export type RecoveryTotals = {
  contracts: number;
  past_due: number;
  settled: number;
  total_outstanding: string;
  /** Weighted by financed amount — the portfolio's true recovery, not a mean
   *  of percentages that would let a tiny settled plan flatter the figure. */
  recovered_pct: string;
  by_tier: { tier_key: string; tier_label: string; count: number }[];
};

export type SnapshotResponse = {
  id: number;
  contract_id: number | null;
  snapshot_no: string;
  created_by: number;
  created_by_name: string;
  legacy: boolean;
  created_at: string;
};

export type SnapshotDetail = SnapshotResponse & {
  payload: Record<string, unknown>;
};

/** Module 7 (SRS §4.7). The recovery register and its archive. */
@Injectable()
export class RecoveryService {
  constructor(
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(LedgerSnapshot)
    private readonly snapshots: Repository<LedgerSnapshot>,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * FR-REC-01-v2. Every contract graded, then filtered, sorted and paged.
   *
   * The grading is the same `buildLedger` the per-contract screen uses, run
   * once per contract — so a tier on this list and the tier on that contract's
   * ledger are the same reading, not two implementations that could drift.
   *
   * Two queries whatever the size: the contracts with their schedules, and
   * every non-voided payment, grouped in memory.
   */
  async findAll(query: ListRecoveryDto): Promise<{
    rows: Paginated<RecoveryRow>;
    totals: RecoveryTotals;
  }> {
    const graded = await this.gradeAll();

    const matching = this.applyFilters(graded, query);
    const sorted = this.applySort(matching, query);

    const start = (query.page - 1) * query.page_size;

    return {
      rows: paginate(
        sorted.slice(start, start + query.page_size),
        sorted.length,
        query.page,
        query.page_size,
      ),
      // Portfolio-wide, like the summary's counters: narrowing the list must
      // not move the banner above it.
      totals: this.totals(graded),
    };
  }

  // ------------------------------------------------------------ archive --

  /**
   * FR-REC-08. An immutable copy of the ledger as it reads right now, for
   * handing to the customer.
   *
   * The payload is the rendered data, not a reference to it: the point of an
   * archive is that it still says what it said, even after another payment
   * lands or a void changes the balance. v1's editable `recovery_reports`
   * rows could not promise that.
   */
  async createSnapshot(
    contractId: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<SnapshotResponse> {
    const contract = await this.contracts.findOne({
      where: { id: contractId },
      relations: { customer: true, product: true, installments: true },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    const payments = await this.payments.find({
      where: { contract_id: contractId, deleted_at: IsNull() },
      select: { id: true, amount: true, payment_date: true },
    });

    const { punctuality_thresholds, loyalty } = await this.settings.getMany([
      'punctuality_thresholds',
      'loyalty',
    ]);

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

    const saved = await this.snapshots.save(
      this.snapshots.create({
        contract_id: contractId,
        kind: SnapshotKind.recovery,
        snapshot_no: this.snapshotNumber(contractId),
        payload: {
          contract: {
            id: contract.id,
            reference: reference(contract.id),
            customer_name: contract.customer?.full_name ?? '',
            customer_cnic: contract.customer?.cnic_number ?? '',
            product_name: contract.product?.name ?? '',
            financed_amount: contract.financed_amount,
            start_date: contract.start_date,
            end_date: contract.end_date,
          },
          rows: report.rows,
          summary: report.summary,
          tier: report.tier,
          distribution: report.distribution,
          taken_at: new Date().toISOString(),
        },
        created_by: actor.id,
      }),
    );

    await this.audit.record({
      actor_id: actor.id,
      entity: 'ledger_snapshot',
      entity_id: String(saved.id),
      action: 'create',
      after: { snapshot_no: saved.snapshot_no, contract_id: contractId },
      ip,
    });

    return this.describe(await this.loadSnapshot(saved.id));
  }

  /** FR-REC-08. Newest first. */
  async listSnapshots(contractId: number): Promise<SnapshotResponse[]> {
    const rows = await this.snapshots.find({
      where: { contract_id: contractId },
      relations: { createdBy: true },
      order: { created_at: 'DESC', id: 'DESC' },
    });

    return rows.map((row) => this.describe(row));
  }

  /** FR-REC-08 / FR-REC-09. The archived payload, exactly as it was stored. */
  async findSnapshot(id: number): Promise<SnapshotDetail> {
    const row = await this.loadSnapshot(id);

    return { ...this.describe(row), payload: row.payload };
  }

  // --------------------------------------------------------- internals --

  private async gradeAll(): Promise<RecoveryRow[]> {
    const contracts = await this.contracts.find({
      relations: { customer: true, product: true, installments: true },
    });

    if (contracts.length === 0) return [];

    const all = await this.payments.find({
      where: { deleted_at: IsNull() },
      select: { id: true, contract_id: true, amount: true, payment_date: true },
    });

    const byContract = new Map<number, typeof all>();

    for (const payment of all) {
      byContract.set(payment.contract_id, [
        ...(byContract.get(payment.contract_id) ?? []),
        payment,
      ]);
    }

    const { punctuality_thresholds, loyalty } = await this.settings.getMany([
      'punctuality_thresholds',
      'loyalty',
    ]);

    const today = new Date().toISOString().slice(0, 10);

    return contracts.map((contract) => {
      const report = buildLedger(
        contract.installments ?? [],
        byContract.get(contract.id) ?? [],
        {
          net_amount: contract.net_amount,
          down_payment: contract.down_payment,
          financed_amount: contract.financed_amount,
        },
        { thresholds: punctuality_thresholds, loyalty },
      );

      // The same test the register's `past_due` filter makes in SQL: a row
      // due before today that the money has not reached.
      const pastDue = report.rows.some(
        (row) => row.due_date < today && row.completed_on === null,
      );

      return {
        contract_id: contract.id,
        reference: reference(contract.id),
        customer_id: contract.customer_id,
        customer_name: contract.customer?.full_name ?? '',
        customer_cnic: contract.customer?.cnic_number ?? '',
        customer_mobile: contract.customer?.mobile_number ?? '',
        product_name: contract.product?.name ?? '',
        status: contract.status,
        financed_amount: contract.financed_amount,
        paid: report.summary.total_paid,
        outstanding: report.summary.outstanding,
        recovered_pct: report.summary.recovered_pct,
        completed_installments: report.summary.completed_installments,
        plan_months: report.summary.plan_months,
        net_days: report.summary.net_days,
        tier_key: report.tier.key,
        tier_label: report.tier.label,
        past_due: pastDue,
      };
    });
  }

  private applyFilters(
    rows: RecoveryRow[],
    query: ListRecoveryDto,
  ): RecoveryRow[] {
    return rows.filter((row) => {
      if (query.tier && row.tier_key !== query.tier) return false;

      if (query.health === 'past_due' && !row.past_due) return false;
      if (query.health === 'settled' && toPaisa(row.outstanding) > 0) {
        return false;
      }
      if (
        query.health === 'on_track' &&
        (row.past_due || toPaisa(row.outstanding) === 0)
      ) {
        return false;
      }

      if (!query.search) return true;

      const needle = query.search.toLowerCase();
      const digits = needle.replace(/\D/g, '');

      return (
        row.customer_name.toLowerCase().includes(needle) ||
        row.product_name.toLowerCase().includes(needle) ||
        (digits !== '' && row.customer_cnic.replace(/\D/g, '').includes(digits))
      );
    });
  }

  private applySort(
    rows: RecoveryRow[],
    query: ListRecoveryDto,
  ): RecoveryRow[] {
    // Best behaviour first when sorting by tier, rather than alphabetically.
    const TIER_ORDER = ['platinum', 'gold', 'silver', 'caution', 'awaiting'];
    const direction = query.dir === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      if (query.sort === 'customer') {
        return a.customer_name.localeCompare(b.customer_name) * direction;
      }

      const value = (row: RecoveryRow): number =>
        query.sort === 'recovered_pct'
          ? Number(row.recovered_pct)
          : query.sort === 'outstanding'
            ? toPaisa(row.outstanding)
            : query.sort === 'tier'
              ? -TIER_ORDER.indexOf(row.tier_key)
              : row.net_days;

      return (value(a) - value(b)) * direction || a.contract_id - b.contract_id;
    });
  }

  private totals(rows: RecoveryRow[]): RecoveryTotals {
    const financed = rows.reduce(
      (sum, row) => sum + toPaisa(row.financed_amount),
      0,
    );
    const paid = rows.reduce((sum, row) => sum + toPaisa(row.paid), 0);

    const tiers = new Map<string, { label: string; count: number }>();

    for (const row of rows) {
      const entry = tiers.get(row.tier_key) ?? {
        label: row.tier_label,
        count: 0,
      };

      entry.count += 1;
      tiers.set(row.tier_key, entry);
    }

    return {
      contracts: rows.length,
      past_due: rows.filter((row) => row.past_due).length,
      settled: rows.filter((row) => toPaisa(row.outstanding) === 0).length,
      total_outstanding: toAmount(
        rows.reduce((sum, row) => sum + toPaisa(row.outstanding), 0),
      ),
      recovered_pct:
        financed === 0
          ? '0.00'
          : Math.min(100, (paid / financed) * 100).toFixed(2),
      by_tier: [...tiers.entries()].map(([tier_key, entry]) => ({
        tier_key,
        tier_label: entry.label,
        count: entry.count,
      })),
    };
  }

  /**
   * Readable, sortable, and unique in practice: a contract cannot be
   * snapshotted twice in the same second by one person. The unique index on
   * `snapshot_no` is the real guard if that ever happens.
   */
  private snapshotNumber(contractId: number): string {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '');

    return `REC-${String(contractId).padStart(4, '0')}-${stamp}`;
  }

  private async loadSnapshot(id: number): Promise<LedgerSnapshot> {
    const row = await this.snapshots.findOne({
      where: { id },
      relations: { createdBy: true },
    });

    if (!row) throw new NotFoundException(`Snapshot ${id} not found`);

    return row;
  }

  private describe(row: LedgerSnapshot): SnapshotResponse {
    return {
      id: row.id,
      contract_id: row.contract_id,
      snapshot_no: row.snapshot_no,
      created_by: row.created_by,
      created_by_name: row.createdBy?.name ?? '',
      legacy: row.legacy,
      created_at: row.created_at.toISOString(),
    };
  }
}

/** Contract 7 reads as SPS-0007, matching the printed agreement. */
function reference(id: number): string {
  return `SPS-${String(id).padStart(4, '0')}`;
}
