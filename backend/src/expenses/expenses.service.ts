import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ExpenseKind, InvestorStatus } from '../common/enums';
import {
  Expense,
  ExpensePeriod,
  ExpensePeriodMember,
  Investor,
} from '../database/entities';
import {
  expensesByInvestor,
  splitCommonExpense,
  toAmount,
  toPaisa,
  type PeriodMember,
} from '../formulas';
import type {
  ExpenseDto,
  ListExpensesDto,
  MembersDto,
  PeriodDto,
} from './dto/expense.dto';

/** SRS §4.15. One line of spending as the register shows it. */
export type ExpenseResponse = {
  id: number;
  kind: ExpenseKind;
  period_id: number | null;
  period_label: string | null;
  investor_id: number | null;
  investor_name: string | null;
  spent_on: string;
  description: string;
  amount: string;
  remarks: string | null;
  entered_by_name: string;
};

/** BR-28. A period with its members and what it came to. */
export type PeriodResponse = {
  id: number;
  label: string;
  starts_on: string;
  ends_on: string | null;
  closed: boolean;
  note: string | null;
  expenses: number;
  total: string;
  /** What each carrying member owes out of this pot. */
  per_member: string;
  /** BR-29. What the business carries for the waived members. */
  absorbed: string;
  members: {
    investor_id: number;
    investor_name: string;
    waived: boolean;
    waive_reason: string | null;
    share: string;
  }[];
};

/** BR-31. One investor's expense position. */
export type InvestorExpenseRow = {
  investor_id: number;
  investor_name: string;
  by_period: {
    period_id: number;
    label: string;
    share: string;
    waived: boolean;
  }[];
  common_total: string;
  individual: string;
  total: string;
};

export type ExpenseReport = {
  periods: { id: number; label: string; total: string }[];
  rows: InvestorExpenseRow[];
  totals: {
    common: string;
    individual: string;
    /** What the investors carry between them. */
    billed: string;
    /** BR-29. What the business absorbed for waived members. */
    absorbed: string;
    /** Everything spent, however it was carried. */
    spent: string;
  };
  generated_at: string;
};

/**
 * Module 15 (SRS §4.15). What the business spends, and who carries it.
 *
 * **Nothing is stored derived.** A share is computed from the pot and its
 * members every time it is read, which is what lets an expense be corrected
 * or deleted outright — unlike an investor ledger line, where a mistake is
 * fixed by a reversing entry because the original is somebody's record.
 */
@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    @InjectRepository(ExpensePeriod)
    private readonly periods: Repository<ExpensePeriod>,
    @InjectRepository(ExpensePeriodMember)
    private readonly members: Repository<ExpensePeriodMember>,
    @InjectRepository(Investor)
    private readonly investors: Repository<Investor>,
    private readonly audit: AuditService,
  ) {}

  // --------------------------------------------------------- the register --

  async findAll(query: ListExpensesDto): Promise<ExpenseResponse[]> {
    const rows = await this.expenses.find({
      where: {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.period_id ? { period_id: query.period_id } : {}),
        ...(query.investor_id ? { investor_id: query.investor_id } : {}),
      },
      relations: { period: true, investor: true, enteredBy: true },
      order: { spent_on: 'DESC', id: 'DESC' },
    });

    const needle = query.search?.toLowerCase();

    return rows
      .filter((row) => {
        // Dates compare as `YYYY-MM-DD` strings: lexicographic order is
        // chronological for that format, and no Date means no time zone.
        if (query.from && row.spent_on < query.from) return false;
        if (query.to && row.spent_on > query.to) return false;

        if (!needle) return true;

        return (
          row.description.toLowerCase().includes(needle) ||
          (row.remarks ?? '').toLowerCase().includes(needle) ||
          (row.investor?.full_name ?? '').toLowerCase().includes(needle) ||
          (row.period?.label ?? '').toLowerCase().includes(needle)
        );
      })
      .map((row) => this.describe(row));
  }

  async create(
    dto: ExpenseDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<ExpenseResponse> {
    await this.assertShape(dto);
    const periodId = await this.resolvePeriod(dto, actor);

    const saved = await this.expenses.save(
      this.expenses.create({
        kind: dto.kind,
        period_id: periodId,
        investor_id:
          dto.kind === ExpenseKind.individual ? dto.investor_id : null,
        spent_on: dto.spent_on,
        description: dto.description,
        amount: dto.amount.toFixed(2),
        remarks: dto.remarks ?? null,
        entered_by: actor.id,
      }),
    );

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense',
      entity_id: String(saved.id),
      action: 'create',
      after: { ...dto, amount: dto.amount.toFixed(2) },
      ip,
    });

    return this.describe(await this.load(saved.id));
  }

  async update(
    id: number,
    dto: ExpenseDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<ExpenseResponse> {
    const before = await this.load(id);

    await this.assertShape(dto);
    const periodId = await this.resolvePeriod(dto, actor);

    await this.expenses.update(
      { id },
      {
        kind: dto.kind,
        period_id: periodId,
        investor_id:
          dto.kind === ExpenseKind.individual ? dto.investor_id : null,
        spent_on: dto.spent_on,
        description: dto.description,
        amount: dto.amount.toFixed(2),
        remarks: dto.remarks ?? null,
      },
    );

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense',
      entity_id: String(id),
      action: 'update',
      before: { ...before, amount: before.amount },
      after: { ...dto, amount: dto.amount.toFixed(2) },
      ip,
    });

    return this.describe(await this.load(id));
  }

  async remove(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const before = await this.load(id);

    await this.expenses.softDelete(id);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense',
      entity_id: String(id),
      action: 'delete',
      before: { ...before, amount: before.amount },
      ip,
    });
  }

  // ----------------------------------------------------------- the periods --

  async listPeriods(): Promise<PeriodResponse[]> {
    const periods = await this.periods.find({
      relations: { members: { investor: true } },
      order: { starts_on: 'DESC', id: 'DESC' },
    });

    if (periods.length === 0) return [];

    const spend = await this.spendByPeriod(periods.map((row) => row.id));

    return periods.map((period) => this.describePeriod(period, spend));
  }

  async createPeriod(
    dto: PeriodDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<PeriodResponse> {
    const saved = await this.periods.save(
      this.periods.create({
        label: dto.label,
        starts_on: dto.starts_on,
        ends_on: dto.ends_on ?? null,
        closed: dto.closed ?? false,
        note: dto.note ?? null,
        created_by: actor.id,
      }),
    );

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense_period',
      entity_id: String(saved.id),
      action: 'create',
      after: { ...dto },
      ip,
    });

    return this.onePeriod(saved.id);
  }

  async updatePeriod(
    id: number,
    dto: PeriodDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<PeriodResponse> {
    const before = await this.loadPeriod(id);

    await this.periods.update(
      { id },
      {
        label: dto.label,
        starts_on: dto.starts_on,
        ends_on: dto.ends_on ?? null,
        closed: dto.closed ?? false,
        note: dto.note ?? null,
      },
    );

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense_period',
      entity_id: String(id),
      action: 'update',
      before: { label: before.label, starts_on: before.starts_on },
      after: { ...dto },
      ip,
    });

    return this.onePeriod(id);
  }

  async removePeriod(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const period = await this.loadPeriod(id);

    const spent = await this.expenses.count({
      where: { period_id: id, deleted_at: IsNull() },
    });

    if (spent > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `${period.label} still holds ${spent} expense${spent === 1 ? '' : 's'}. Move or delete them first — deleting the period would leave them charged to nobody.`,
      });
    }

    await this.periods.softDelete(id);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense_period',
      entity_id: String(id),
      action: 'delete',
      before: { label: period.label },
      ip,
    });
  }

  /**
   * BR-28/BR-29. Replaces a period's membership wholesale.
   *
   * One call rather than add/remove per investor: who carries a pot is a
   * single decision, and applying it row by row would leave the split briefly
   * wrong between requests.
   */
  async setMembers(
    id: number,
    dto: MembersDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<PeriodResponse> {
    await this.loadPeriod(id);

    const seen = new Set<number>();

    for (const member of dto.members) {
      if (seen.has(member.investor_id)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: `Investor ${member.investor_id} appears twice in the member list.`,
        });
      }

      seen.add(member.investor_id);

      if (member.waived && !member.waive_reason?.trim()) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message:
            'Waiving a share needs a reason (BR-29) — the business carries it instead, and a reader has to be able to see why.',
          field_errors: { waive_reason: 'Say why this share is not charged' },
        });
      }
    }

    if (seen.size > 0) {
      const known = await this.investors.count({
        where: { id: In([...seen]) },
      });

      if (known !== seen.size) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: 'One of those investors does not exist.',
        });
      }
    }

    await this.members.delete({ period_id: id });

    if (dto.members.length > 0) {
      await this.members.save(
        dto.members.map((member) =>
          this.members.create({
            period_id: id,
            investor_id: member.investor_id,
            waived: member.waived ?? false,
            waive_reason: member.waived
              ? (member.waive_reason?.trim() ?? null)
              : null,
          }),
        ),
      );
    }

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense_period',
      entity_id: String(id),
      action: 'update',
      after: { members: dto.members },
      ip,
    });

    return this.onePeriod(id);
  }

  // ------------------------------------------------------------ the report --

  /** BR-31. The matrix: every investor against every period, plus their own. */
  async report(): Promise<ExpenseReport> {
    const [periods, individual, investors] = await Promise.all([
      this.periods.find({
        relations: { members: true },
        order: { starts_on: 'ASC' },
      }),
      this.expenses.find({
        where: { kind: ExpenseKind.individual, deleted_at: IsNull() },
        select: { id: true, investor_id: true, amount: true },
      }),
      this.investors.find({ select: { id: true, full_name: true } }),
    ]);

    const names = new Map(investors.map((row) => [row.id, row.full_name]));
    const spend = await this.spendByPeriod(periods.map((row) => row.id));

    const shaped = periods.map((period) => ({
      period_id: period.id,
      total: toAmount(spend.get(period.id) ?? 0),
      members: (period.members ?? []).map<PeriodMember>((member) => ({
        investor_id: member.investor_id,
        waived: member.waived,
      })),
    }));

    const rows = expensesByInvestor(
      shaped,
      individual.map((row) => ({
        investor_id: row.investor_id ?? 0,
        amount: row.amount,
      })),
    );

    const labels = new Map(periods.map((row) => [row.id, row.label]));

    const absorbed = shaped.reduce(
      (sum, period) =>
        sum + splitCommonExpense(period.total, period.members).absorbed,
      0,
    );

    const common = [...spend.values()].reduce((sum, value) => sum + value, 0);
    const own = individual.reduce((sum, row) => sum + toPaisa(row.amount), 0);
    const billed = rows.reduce((sum, row) => sum + row.total, 0);

    return {
      periods: periods.map((period) => ({
        id: period.id,
        label: period.label,
        total: toAmount(spend.get(period.id) ?? 0),
      })),
      rows: rows.map((row) => ({
        investor_id: row.investor_id,
        investor_name: names.get(row.investor_id) ?? '',
        by_period: row.common.map((entry) => ({
          period_id: entry.period_id,
          label: labels.get(entry.period_id) ?? '',
          share: toAmount(entry.share),
          waived: entry.waived,
        })),
        common_total: toAmount(row.common_total),
        individual: toAmount(row.individual),
        total: toAmount(row.total),
      })),
      totals: {
        common: toAmount(common),
        individual: toAmount(own),
        billed: toAmount(billed),
        absorbed: toAmount(absorbed),
        spent: toAmount(common + own),
      },
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * BR-31. What each investor carries, for the balances that net it off.
   *
   * Keyed by investor so `bucketBalances` can subtract it from payable without
   * knowing anything about periods.
   */
  async chargedByInvestor(): Promise<Map<number, number>> {
    const report = await this.report();

    return new Map(
      report.rows.map((row) => [row.investor_id, toPaisa(row.total)]),
    );
  }

  /** Everything the business spent, for the Summary Report's net balance. */
  async totalSpent(): Promise<number> {
    const rows = await this.expenses.find({
      where: { deleted_at: IsNull() },
      select: { id: true, amount: true },
    });

    return rows.reduce((sum, row) => sum + toPaisa(row.amount), 0);
  }

  // --------------------------------------------------------- internals --

  private async assertShape(dto: ExpenseDto): Promise<void> {
    if (dto.kind === ExpenseKind.common) {
      // No period named is fine: `resolvePeriod` files it under the open
      // one, so the everyday case needs no choice at all.
      if (!dto.period_id) return;

      const period = await this.loadPeriod(dto.period_id);

      if (period.closed) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `${period.label} is closed. Reopen it, or record this against an open period.`,
        });
      }

      return;
    }

    if (!dto.investor_id) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          'An individual expense is carried by one investor. Choose who.',
        field_errors: { investor_id: 'Required for an individual expense' },
      });
    }

    const investor = await this.investors.findOne({
      where: { id: dto.investor_id },
    });

    if (!investor) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Investor "${dto.investor_id}" does not exist`,
      });
    }
  }

  /**
   * Which period a common expense lands in when the caller did not say.
   *
   * The open period whose dates cover the expense, else the newest open one.
   * With no open period at all, one is opened on the spot with **every active
   * investor as a member** — which is what "divide it between the investors"
   * means to somebody who has never heard of a period. Periods only need
   * attention when the roster changes; until then they look after themselves.
   */
  private async resolvePeriod(
    dto: ExpenseDto,
    actor: AuthenticatedUser,
  ): Promise<number | null> {
    if (dto.kind !== ExpenseKind.common) return null;
    if (dto.period_id) return dto.period_id;

    const open = await this.periods.find({
      where: { closed: false },
      order: { starts_on: 'DESC', id: 'DESC' },
    });

    const covering = open.find(
      (period) =>
        period.starts_on <= dto.spent_on &&
        (period.ends_on === null || period.ends_on >= dto.spent_on),
    );

    if (covering ?? open[0]) return (covering ?? open[0]).id;

    const count = await this.periods.count({ withDeleted: true });

    const period = await this.periods.save(
      this.periods.create({
        label: `Common-${count + 1}`,
        starts_on: dto.spent_on,
        ends_on: null,
        closed: false,
        note: null,
        created_by: actor.id,
      }),
    );

    const active = await this.investors.find({
      where: { status: InvestorStatus.active },
      select: { id: true },
    });

    await this.members.save(
      active.map((investor) =>
        this.members.create({
          period_id: period.id,
          investor_id: investor.id,
          waived: false,
          waive_reason: null,
        }),
      ),
    );

    await this.audit.record({
      actor_id: actor.id,
      entity: 'expense_period',
      entity_id: String(period.id),
      action: 'create',
      after: { label: period.label, members: active.map((row) => row.id) },
    });

    return period.id;
  }

  /** Non-deleted spend per period, in paisa. */
  private async spendByPeriod(ids: number[]): Promise<Map<number, number>> {
    const totals = new Map<number, number>();

    if (ids.length === 0) return totals;

    const rows = await this.expenses.find({
      where: {
        kind: ExpenseKind.common,
        period_id: In(ids),
        deleted_at: IsNull(),
      },
      select: { id: true, period_id: true, amount: true },
    });

    for (const row of rows) {
      if (row.period_id === null) continue;

      totals.set(
        row.period_id,
        (totals.get(row.period_id) ?? 0) + toPaisa(row.amount),
      );
    }

    return totals;
  }

  private async onePeriod(id: number): Promise<PeriodResponse> {
    const period = await this.periods.findOne({
      where: { id },
      relations: { members: { investor: true } },
    });

    if (!period) throw new NotFoundException(`No expense period with id ${id}`);

    return this.describePeriod(period, await this.spendByPeriod([id]));
  }

  private describePeriod(
    period: ExpensePeriod,
    spend: Map<number, number>,
  ): PeriodResponse {
    const members = period.members ?? [];
    const total = spend.get(period.id) ?? 0;

    const split = splitCommonExpense(
      toAmount(total),
      members.map((member) => ({
        investor_id: member.investor_id,
        waived: member.waived,
      })),
    );

    const shares = new Map(
      split.shares.map((share) => [share.investor_id, share.share]),
    );

    return {
      id: period.id,
      label: period.label,
      starts_on: period.starts_on,
      ends_on: period.ends_on,
      closed: period.closed,
      note: period.note,
      expenses: members.length === 0 ? 0 : members.length,
      total: toAmount(total),
      per_member: toAmount(
        split.divided_between === 0
          ? 0
          : Math.round(total / members.length || 0),
      ),
      absorbed: toAmount(split.absorbed),
      members: members.map((member) => ({
        investor_id: member.investor_id,
        investor_name: member.investor?.full_name ?? '',
        waived: member.waived,
        waive_reason: member.waive_reason,
        share: toAmount(shares.get(member.investor_id) ?? 0),
      })),
    };
  }

  private describe(row: Expense): ExpenseResponse {
    return {
      id: row.id,
      kind: row.kind,
      period_id: row.period_id,
      period_label: row.period?.label ?? null,
      investor_id: row.investor_id,
      investor_name: row.investor?.full_name ?? null,
      spent_on: row.spent_on,
      description: row.description,
      amount: row.amount,
      remarks: row.remarks,
      entered_by_name: row.enteredBy?.name ?? '',
    };
  }

  private async load(id: number): Promise<Expense> {
    const row = await this.expenses.findOne({
      where: { id },
      relations: { period: true, investor: true, enteredBy: true },
    });

    if (!row) throw new NotFoundException(`No expense with id ${id}`);

    return row;
  }

  private async loadPeriod(id: number): Promise<ExpensePeriod> {
    const row = await this.periods.findOne({ where: { id } });

    if (!row) throw new NotFoundException(`No expense period with id ${id}`);

    return row;
  }
}
