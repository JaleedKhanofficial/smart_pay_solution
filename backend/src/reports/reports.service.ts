import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CapitalSource } from '../common/enums';
import { paginate, type Paginated } from '../common/pagination';
import {
  CapitalEntry,
  Contract,
  ExpenseEntry,
  Payment,
} from '../database/entities';
import {
  scoreDeal,
  summariseDeal,
  toAmount,
  toPaisa,
  totalPortfolio,
  type DealScore,
  type DealSummary,
  type PortfolioTotals,
} from '../formulas';
import { EntryDto } from './dto/entry.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';

/** FR-SUM-01-v2. One deal, with every BR-08 column already worked out. */
export type SummaryRow = DealSummary &
  DealScore & {
    contract_id: number;
    customer_id: number;
    customer_name: string;
    customer_mobile: string;
    customer_cnic: string;
    /** The product category — v1 called this the deal type. */
    deal_type: string;
    product_name: string;
    sale_price: string;
    markup_pct: string;
    plan_months: number;
    down_payment: string;
    status: string;
    start_date: string;
  };

/** FR-SUM-02-v2. A capital or expense record. */
export type EntryResponse = {
  id: number;
  amount: string;
  period_label: string;
  note: string | null;
  entered_by: number;
  entered_by_name: string;
  created_at: string;
};

/** FR-SUM-03. The banner ranking categories by share of the portfolio. */
export type DealTypeShare = {
  deal_type: string;
  deals: number;
  share_pct: string;
  total_sale: string;
};

/** FR-SUM-06. Clients the report cannot fully identify. */
export type MissingData = {
  no_mobile: { customer_id: number; customer_name: string }[];
  no_cnic: { customer_id: number; customer_name: string }[];
};

export type SummaryResponse = {
  rows: Paginated<SummaryRow>;
  /** Computed across the **whole** portfolio, not the page. */
  totals: PortfolioTotals;
  capital: { total: string; entries: EntryResponse[] };
  expenses: { total: string; entries: EntryResponse[] };
  deal_types: DealTypeShare[];
  missing: MissingData;
  generated_at: string;
};

/** Module 8 (SRS §4.8). The internal workbook, computed server-side. */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(CapitalEntry)
    private readonly capital: Repository<CapitalEntry>,
    @InjectRepository(ExpenseEntry)
    private readonly expenses: Repository<ExpenseEntry>,
    private readonly audit: AuditService,
  ) {}

  /**
   * FR-SUM-01-v2 / FR-SUM-03 / FR-SUM-09.
   *
   * Every deal is loaded and summarised, then the page is cut from the result.
   * That is deliberate: the totals, the category shares and the missing-data
   * counters are portfolio-wide figures, and computing them from a page would
   * make them change as you turn it. Three queries regardless of size — the
   * contracts, one grouped payment sum, and the entries.
   */
  async summary(query: SummaryQueryDto): Promise<SummaryResponse> {
    const contracts = await this.contracts.find({
      relations: { customer: true, product: { category: true } },
    });

    const paidByContract = await this.paidByContract(
      contracts.map((contract) => contract.id),
    );

    const rows: SummaryRow[] = contracts.map((contract) => {
      const paid = paidByContract.get(contract.id) ?? 0;

      const summary = summariseDeal({
        sale_price: contract.sale_price,
        markup_amount: contract.markup_amount,
        down_payment: contract.down_payment,
        paid,
      });

      return {
        ...summary,
        ...scoreDeal(summary, paid),
        contract_id: contract.id,
        customer_id: contract.customer_id,
        customer_name: contract.customer?.full_name ?? '',
        customer_mobile: contract.customer?.mobile_number ?? '',
        customer_cnic: contract.customer?.cnic_number ?? '',
        deal_type: contract.product?.category?.name ?? 'Uncategorised',
        product_name: contract.product?.name ?? '',
        sale_price: contract.sale_price,
        markup_pct: contract.markup_pct,
        plan_months: contract.plan_months,
        down_payment: contract.down_payment,
        status: contract.status,
        start_date: contract.start_date,
      };
    });

    const [capital, expenses] = await Promise.all([
      this.listEntries(this.capital),
      this.listEntries(this.expenses),
    ]);

    const capitalTotal = this.sumEntries(capital);
    const expenseTotal = this.sumEntries(expenses);

    const matching = this.applySearch(rows, query);

    return {
      rows: this.paginate(this.applySort(matching, query), query),
      totals: totalPortfolio(rows, capitalTotal, expenseTotal),
      capital: { total: toAmount(capitalTotal), entries: capital },
      expenses: { total: toAmount(expenseTotal), entries: expenses },
      deal_types: this.dealTypes(rows),
      missing: this.missingData(rows),
      generated_at: new Date().toISOString(),
    };
  }

  // ---------------------------------------------- capital and expenses --

  /** FR-SUM-02-v2 */
  async addCapital(
    dto: EntryDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<EntryResponse> {
    const saved = await this.capital.save(
      this.capital.create({
        amount: toAmount(toPaisa(dto.amount)),
        period_label: dto.period_label,
        note: dto.note ?? null,
        entered_by: actor.id,
        // FR-SUM-10: investor money is never a capital entry, which is why the
        // enum has one member rather than being a free choice.
        source: CapitalSource.own,
      }),
    );

    await this.recordEntry('capital_entry', saved.id, dto, actor, ip);

    return this.describeEntry(await this.loadCapital(saved.id));
  }

  /** FR-SUM-02-v2 */
  async addExpense(
    dto: EntryDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<EntryResponse> {
    const saved = await this.expenses.save(
      this.expenses.create({
        amount: toAmount(toPaisa(dto.amount)),
        period_label: dto.period_label,
        note: dto.note ?? null,
        entered_by: actor.id,
      }),
    );

    await this.recordEntry('expense_entry', saved.id, dto, actor, ip);

    return this.describeEntry(await this.loadExpense(saved.id));
  }

  async removeCapital(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const row = await this.loadCapital(id);

    await this.capital.softDelete(id);
    await this.recordRemoval('capital_entry', id, row, actor, ip);
  }

  async removeExpense(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const row = await this.loadExpense(id);

    await this.expenses.softDelete(id);
    await this.recordRemoval('expense_entry', id, row, actor, ip);
  }

  // --------------------------------------------------------- internals --

  private async paidByContract(ids: number[]): Promise<Map<number, number>> {
    if (ids.length === 0) return new Map();

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

  /** FR-SUM-05. Scoped search; `all` spans the three identifying columns. */
  private applySearch(
    rows: SummaryRow[],
    query: SummaryQueryDto,
  ): SummaryRow[] {
    if (!query.search) return rows;

    const needle = query.search.toLowerCase();

    // Punctuation differs between what is typed and what is stored, so CNIC
    // and mobile match on digits alone: "03001234567" finds "0300-1234567".
    const digits = needle.replace(/\D/g, '');
    const bare = (value: string) => value.replace(/\D/g, '');

    return rows.filter((row) => {
      const byName = row.customer_name.toLowerCase().includes(needle);
      const byMobile =
        digits !== '' && bare(row.customer_mobile).includes(digits);
      const byCnic = digits !== '' && bare(row.customer_cnic).includes(digits);

      if (query.scope === 'name') return byName;
      if (query.scope === 'mobile') return byMobile;
      if (query.scope === 'cnic') return byCnic;

      return (
        byName ||
        byMobile ||
        byCnic ||
        row.product_name.toLowerCase().includes(needle) ||
        row.deal_type.toLowerCase().includes(needle)
      );
    });
  }

  /** FR-SUM-05 */
  private applySort(rows: SummaryRow[], query: SummaryQueryDto): SummaryRow[] {
    const direction = query.dir === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      if (query.sort === 'customer_name') {
        return a.customer_name.localeCompare(b.customer_name) * direction;
      }

      const value = (row: SummaryRow): number =>
        query.sort === 'sale_price'
          ? toPaisa(row.sale_price)
          : query.sort === 'paid'
            ? toPaisa(row.paid)
            : query.sort === 'outstanding'
              ? toPaisa(row.outstanding)
              : Number(query.sort === 'score' ? row.score : row.pct_completed);

      // Contract id breaks ties so rows do not shuffle between pages.
      return (value(a) - value(b)) * direction || a.contract_id - b.contract_id;
    });
  }

  private paginate(
    rows: SummaryRow[],
    query: SummaryQueryDto,
  ): Paginated<SummaryRow> {
    const start = (query.page - 1) * query.page_size;

    return paginate(
      rows.slice(start, start + query.page_size),
      rows.length,
      query.page,
      query.page_size,
    );
  }

  /** FR-SUM-03. Categories ranked by share of the portfolio's sale value. */
  private dealTypes(rows: SummaryRow[]): DealTypeShare[] {
    const groups = new Map<string, { deals: number; total: number }>();

    for (const row of rows) {
      const group = groups.get(row.deal_type) ?? { deals: 0, total: 0 };

      group.deals += 1;
      group.total += toPaisa(row.total_sale);
      groups.set(row.deal_type, group);
    }

    const portfolio = [...groups.values()].reduce(
      (sum, group) => sum + group.total,
      0,
    );

    return [...groups.entries()]
      .map(([deal_type, group]) => ({
        deal_type,
        deals: group.deals,
        total_sale: toAmount(group.total),
        share_pct:
          portfolio === 0
            ? '0.00'
            : ((group.total / portfolio) * 100).toFixed(2),
      }))
      .sort((a, b) => Number(b.share_pct) - Number(a.share_pct));
  }

  /**
   * FR-SUM-06. A client counts once however many contracts they hold — the
   * counter is asking how many people cannot be contacted, not how many rows.
   */
  private missingData(rows: SummaryRow[]): MissingData {
    const noMobile = new Map<number, string>();
    const noCnic = new Map<number, string>();

    for (const row of rows) {
      if (row.customer_mobile.trim() === '') {
        noMobile.set(row.customer_id, row.customer_name);
      }

      if (row.customer_cnic.trim() === '') {
        noCnic.set(row.customer_id, row.customer_name);
      }
    }

    const list = (map: Map<number, string>) =>
      [...map.entries()].map(([customer_id, customer_name]) => ({
        customer_id,
        customer_name,
      }));

    return { no_mobile: list(noMobile), no_cnic: list(noCnic) };
  }

  private async listEntries(
    repository: Repository<CapitalEntry> | Repository<ExpenseEntry>,
  ): Promise<EntryResponse[]> {
    const rows = await repository.find({
      relations: { enteredBy: true },
      order: { period_label: 'DESC', id: 'DESC' },
    });

    return rows.map((row) => this.describeEntry(row));
  }

  private sumEntries(entries: EntryResponse[]): number {
    return entries.reduce((sum, entry) => sum + toPaisa(entry.amount), 0);
  }

  private describeEntry(row: CapitalEntry | ExpenseEntry): EntryResponse {
    return {
      id: row.id,
      amount: row.amount,
      period_label: row.period_label,
      note: row.note,
      entered_by: row.entered_by,
      entered_by_name: row.enteredBy?.name ?? '',
      created_at: row.created_at.toISOString(),
    };
  }

  // Two concrete loaders rather than one generic: TypeORM's find options are
  // typed per entity, and a generic repository would need a cast at each use
  // to satisfy them. Ten lines is cheaper than teaching the compiler a lie.
  private async loadCapital(id: number): Promise<CapitalEntry> {
    const row = await this.capital.findOne({
      where: { id },
      relations: { enteredBy: true },
    });

    if (!row) throw new NotFoundException(`Capital entry ${id} not found`);

    return row;
  }

  private async loadExpense(id: number): Promise<ExpenseEntry> {
    const row = await this.expenses.findOne({
      where: { id },
      relations: { enteredBy: true },
    });

    if (!row) throw new NotFoundException(`Expense entry ${id} not found`);

    return row;
  }

  private async recordRemoval(
    entity: string,
    id: number,
    row: CapitalEntry | ExpenseEntry,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    await this.audit.record({
      actor_id: actor.id,
      entity,
      entity_id: String(id),
      action: 'delete',
      before: { ...this.describeEntry(row) },
      ip,
    });
  }

  private async recordEntry(
    entity: string,
    id: number,
    dto: EntryDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    await this.audit.record({
      actor_id: actor.id,
      entity,
      entity_id: String(id),
      action: 'create',
      after: { ...dto },
      ip,
    });
  }
}
