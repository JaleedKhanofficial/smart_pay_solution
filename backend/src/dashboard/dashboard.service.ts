import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContractStatus, InvestorStatus } from '../common/enums';
import {
  Contract,
  ContractFunding,
  Customer,
  Installment,
  Investor,
  Payment,
} from '../database/entities';
import {
  matureProfit,
  outstandingOf,
  splitRecovery,
  toAmount,
  toPaisa,
  type FundingRow,
} from '../formulas';
import { InvestorsService } from '../investors/investors.service';
import type { DashboardQueryDto } from './dto/dashboard-query.dto';

/** FR-DSH-09. A recent collection, with enough context to recognise it. */
export type RecentPayment = {
  id: number;
  contract_id: number;
  customer_name: string;
  product_name: string;
  amount: string;
  payment_date: string;
  method: string;
};

/** FR-DSH-15. One investor's collections, month by month. */
export type CollectionsSeries = {
  investor_id: number;
  investor_name: string;
  /** One figure per entry in `months`, as an amount string. */
  values: string[];
};

/** FR-DSH-01..16. One payload; the whole screen renders from it. */
export type DashboardResponse = {
  /**
   * FR-DSH-13. Set when the figures below are one investor's, null for the
   * whole portfolio.
   */
  investor: { id: number; full_name: string } | null;
  /**
   * FR-DSH-16. The period the figures describe, or null for everything.
   *
   * With a period, **flows** (collections, contracts started, customers
   * added, the chart) are what happened inside it, and **stocks**
   * (outstanding, profit, net capital, past due) are as they stood at its
   * last day. A balance cannot be "between" two dates; it can only be "as
   * at" one.
   */
  period: { from: string | null; to: string | null };
  /** BR-24. Deposits less withdrawals, adjustments and losses. */
  net_capital: string;
  collections: {
    today: string;
    month: string;
    all_time: string;
    /** FR-DSH-16. Inside the period; null when there is none. */
    period: string | null;
  };
  /** FR-DSH-04-v2. Markup included, so it agrees with the contract screen. */
  outstanding: string;
  /** FR-DSH-10-v2 / BR-09. */
  mature_profit: string;
  unmatured_profit: string;
  counts: {
    active_plans: number;
    customers: number;
    contracts: number;
    /** Module 13. Whose capital is buying the stock. */
    investors: number;
    active_investors: number;
  };
  recent_payments: RecentPayment[];
  /** FR-DSH-12. Contracts carrying an unpaid installment past its due date. */
  past_due_contracts: number;
  /** FR-DSH-20. The portfolio as percentages, each with what it is a share of. */
  rates: Rates;
  /**
   * FR-DSH-15. What came in each month, split by the investors whose money
   * the contracts were bought with. One series per investor, or the one
   * investor's alone when filtered. The last twelve months unless a period
   * is given, in which case the months the period spans.
   */
  collections_by_month: { months: string[]; series: CollectionsSeries[] };
  /**
   * FR-DSH-17. The same handful of figures for the period and for the one
   * before it, so a tile can say "▲ 12% vs last month". Null when there is
   * nothing sensible to compare against (a period with only one end).
   */
  comparison: {
    current: Figures;
    previous: Figures;
    /** "This month so far" / "1 Jan – 31 Mar". */
    current_label: string;
    /** "the same days last month" / "the 90 days before". */
    previous_label: string;
  } | null;
  /**
   * FR-DSH-18. One card per investor whose money is in a contract: what
   * they have in play and what it has done in the period. Filtered to one
   * investor, their card alone.
   */
  scorecards: Scorecard[];
  /** FR-DSH-19. What came in, by how it was paid, inside the period. */
  collections_by_method: { method: string; amount: string; count: number }[];
  generated_at: string;
};

/**
 * FR-DSH-20. A percentage and the two numbers behind it, so "71%" can carry
 * "14 of 84" underneath rather than stand alone. `pct` is null when nothing
 * was measured: 0 of 0 is not 0%.
 */
export type Rate = {
  numerator: string;
  denominator: string;
  pct: string | null;
};

export type Rates = {
  /**
   * Installments that fell due in the period and were covered by what had
   * been paid by their due date. The measure of how promptly customers pay.
   */
  on_time: Rate;
  /**
   * Of what fell due in the period, how much had been paid by its end —
   * read cumulatively against the schedule, so a customer who paid the whole
   * plan off in advance is 100% collected in every later month, not 0%.
   */
  collection: Rate;
  /** Everything ever collected against everything financed, as at the end. */
  recovered: Rate;
  /** Mature profit against the whole markup, as at the end (BR-09). */
  profit_matured: Rate;
  /** Active contracts with an installment past due, as at the end. */
  past_due: Rate;
};

/** FR-DSH-17. The figures a period is compared on. */
export type Figures = {
  /** Collected inside the window. */
  collected: string;
  /** Contracts started inside the window. */
  contracts: number;
  /** Customers registered inside the window. */
  customers: number;
  /** As at the window's last day. */
  net_capital: string;
  outstanding: string;
  mature_profit: string;
  /** FR-DSH-20. The rates, as percentages, or null where nothing was measured. */
  on_time_pct: string | null;
  collection_pct: string | null;
  recovered_pct: string | null;
  profit_matured_pct: string | null;
  past_due_pct: string | null;
};

/** FR-DSH-18. An investor's card. */
export type Scorecard = {
  investor_id: number;
  investor_name: string;
  status: InvestorStatus;
  /** Contracts their money is in. */
  contracts: number;
  net_capital: string;
  /** Their share, inside the period (or all time without one). */
  collected: string;
  /** Their share, inside the comparison's previous window; null without one. */
  collected_before: string | null;
  outstanding: string;
  mature_profit: string;
  /** FR-DSH-20. Their contracts' promptness and collection rate. */
  on_time: Rate;
  collection: Rate;
};

/** Everything but the parts that compare periods or fan out per investor. */
type Core = Omit<
  DashboardResponse,
  'comparison' | 'scorecards' | 'collections_by_method'
>;

/** FR-DSH-16. The period, both ends optional and inclusive. */
type Window = { from?: string; to?: string };

/** `YYYY-MM-DD` shifted by whole days, in UTC. */
function shiftDays(date: string, by: number): string {
  const at = new Date(`${date}T00:00:00Z`);

  at.setUTCDate(at.getUTCDate() + by);

  return at.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, both inclusive. */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();

  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * FR-DSH-17. What "the period before" means.
 *
 * A closed period is compared with the run of the same number of days
 * ending the day before it started: 1–31 March against 29 Jan–28 Feb. No
 * period at all means this month so far against the same days of last
 * month, so the 12th of April is compared with 1–12 March and not with the
 * whole of it. A period with only one end has no length to mirror, and a
 * comparison against nothing in particular would mislead more than it told.
 */
function comparisonWindows(
  window: Window,
): { current: Window; previous: Window; labels: [string, string] } | null {
  if (window.from && window.to) {
    const length = daysBetween(window.from, window.to);
    const to = shiftDays(window.from, -1);

    return {
      current: window,
      previous: { from: shiftDays(to, -(length - 1)), to },
      labels: [
        'the period',
        `the ${length} day${length === 1 ? '' : 's'} before`,
      ],
    };
  }

  if (window.from || window.to) return null;

  const now = today();
  const [year, month, day] = now.split('-').map(Number);
  const firstOfMonth = `${now.slice(0, 7)}-01`;
  const lastMonth = new Date(Date.UTC(year, month - 2, 1));
  const daysInLastMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const lastFrom = lastMonth.toISOString().slice(0, 10);
  const lastTo = `${lastFrom.slice(0, 7)}-${String(Math.min(day, daysInLastMonth)).padStart(2, '0')}`;

  return {
    current: { from: firstOfMonth, to: now },
    previous: { from: lastFrom, to: lastTo },
    labels: ['this month so far', 'the same days last month'],
  };
}

function figuresOf(core: Core): Figures {
  return {
    collected: core.collections.period ?? core.collections.all_time,
    contracts: core.counts.contracts,
    customers: core.counts.customers,
    net_capital: core.net_capital,
    outstanding: core.outstanding,
    mature_profit: core.mature_profit,
    on_time_pct: core.rates.on_time.pct,
    collection_pct: core.rates.collection.pct,
    recovered_pct: core.rates.recovered.pct,
    profit_matured_pct: core.rates.profit_matured.pct,
    past_due_pct: core.rates.past_due.pct,
  };
}

/** A share as `"71.43"`, or null when there is nothing to be a share of. */
function pct(numerator: number, denominator: number): string | null {
  return denominator > 0 ? ((numerator / denominator) * 100).toFixed(2) : null;
}

/** Today as `YYYY-MM-DD`, in UTC — the same day the database's CURRENT_DATE is. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The calendar months a window spans as `YYYY-MM`, oldest first. Without a
 * window, the last twelve; with only one end, twelve months ending or
 * starting there.
 */
function monthsOf(window: Window): string[] {
  const monthOf = (date: string) => {
    const [year, month] = date.slice(0, 7).split('-').map(Number);

    return { year, month };
  };

  const shift = (
    { year, month }: { year: number; month: number },
    by: number,
  ) => new Date(Date.UTC(year, month - 1 + by, 1)).toISOString().slice(0, 7);

  const end = monthOf(window.to ?? today());
  const start = window.from
    ? monthOf(window.from)
    : monthOf(shift(end, -11) + '-01');

  const months: string[] = [];
  let cursor = start;

  while (months.length < 240) {
    const label = shift(cursor, 0);

    months.push(label);

    if (label >= shift(end, 0)) break;

    cursor = monthOf(shift(cursor, 1) + '-01');
  }

  return months;
}

/**
 * Module 1 (SRS §4.1). One aggregate call rather than v1's nine round trips
 * (NFR-07).
 *
 * Every figure is derived from the payments and installments tables — there is
 * no stored balance anywhere in this system, so the dashboard cannot drift
 * from the contract screen or the ledger the way v1's did (§9.3 item 1).
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Investor)
    private readonly investors: Repository<Investor>,
    @InjectRepository(ContractFunding)
    private readonly fundings: Repository<ContractFunding>,
    private readonly investorsService: InvestorsService,
  ) {}

  async summary(query: DashboardQueryDto): Promise<DashboardResponse> {
    const window: Window = { from: query.from, to: query.to };

    if (window.from && window.to && window.from > window.to) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The period ends before it starts.',
        field_errors: { to: 'Must be on or after the start date' },
      });
    }

    const core =
      query.investor_id !== undefined
        ? await this.forInvestor(query.investor_id, window)
        : await this.build(window);

    const windows = comparisonWindows(window);

    // The comparison is two more reads of the same figures, not a separate
    // set of rules: whatever the tiles say for this period, they would have
    // said for the one before it.
    const [currentCore, previousCore] = windows
      ? await Promise.all([
          query.investor_id !== undefined
            ? this.forInvestor(query.investor_id, windows.current)
            : this.build(windows.current),
          query.investor_id !== undefined
            ? this.forInvestor(query.investor_id, windows.previous)
            : this.build(windows.previous),
        ])
      : [null, null];

    return {
      ...core,
      comparison:
        windows && currentCore && previousCore
          ? {
              current: figuresOf(currentCore),
              previous: figuresOf(previousCore),
              current_label: windows.labels[0],
              previous_label: windows.labels[1],
            }
          : null,
      scorecards: await this.scorecards(
        window,
        windows?.previous,
        query.investor_id,
      ),
      collections_by_method: await this.collectionsByMethod(
        window,
        query.investor_id,
      ),
    };
  }

  /** FR-DSH-01..16 for the whole portfolio. */
  private async build(window: Window): Promise<Core> {
    const [collections, money, counts, recent, past_due_contracts, rates] =
      await Promise.all([
        this.collections(window),
        this.portfolioMoney(window),
        this.counts(window),
        this.recentPayments(undefined, window),
        this.pastDueCount(window),
        this.rates(window),
      ]);

    return {
      investor: null,
      period: { from: window.from ?? null, to: window.to ?? null },
      net_capital: await this.investorsService.netCapital(window.to),
      collections_by_month: await this.collectionsByMonth(undefined, window),
      collections,
      outstanding: money.outstanding,
      mature_profit: money.mature,
      unmatured_profit: money.unmatured,
      counts,
      recent_payments: recent,
      past_due_contracts,
      rates,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * FR-DSH-13. The same screen for one investor.
   *
   * Only the contracts their money is in count, and every money figure is
   * **their share** of it: a 90,000 stake in a 140,000 unit sees 64.29% of
   * what that contract collects and owes, not all of it. Profit goes through
   * `splitRecovery` (BR-18) so the tile agrees with the funding register to
   * the paisa, capital first and the residual on the largest stake (BR-26).
   *
   * Counts are the contracts and customers behind those stakes, and Net
   * capital is theirs alone (BR-24). Recent collections show the whole
   * payment, since a payment is a record, not a share.
   */
  private async forInvestor(investorId: number, window: Window): Promise<Core> {
    const investor = await this.investors.findOne({
      where: { id: investorId },
    });

    if (!investor) {
      throw new NotFoundException(`Investor ${investorId} not found`);
    }

    const own = await this.fundings.find({
      where: { investor_id: investorId },
      select: { contract_id: true },
    });

    const ids = [...new Set(own.map((row) => row.contract_id))];
    const named = { id: investor.id, full_name: investor.full_name };
    const activeInvestor = investor.status === InvestorStatus.active ? 1 : 0;
    const period = { from: window.from ?? null, to: window.to ?? null };
    const net_capital = await this.investorsService.netCapital(
      window.to,
      investorId,
    );

    if (ids.length === 0) {
      const months = monthsOf(window);

      return {
        investor: named,
        period,
        net_capital,
        collections: {
          today: '0.00',
          month: '0.00',
          all_time: '0.00',
          period: window.from || window.to ? '0.00' : null,
        },
        outstanding: '0.00',
        mature_profit: '0.00',
        unmatured_profit: '0.00',
        counts: {
          active_plans: 0,
          customers: 0,
          contracts: 0,
          investors: 1,
          active_investors: activeInvestor,
        },
        recent_payments: [],
        past_due_contracts: 0,
        rates: await this.rates(window, [], new Map()),
        collections_by_month: {
          months,
          series: [
            {
              investor_id: investor.id,
              investor_name: investor.full_name,
              values: months.map(() => '0.00'),
            },
          ],
        },
        generated_at: new Date().toISOString(),
      };
    }

    // Every stake on those contracts, not only this investor's: a share is
    // only defined against the whole set (BR-26).
    const [contracts, stakes, payments, dueToDate] = await Promise.all([
      this.contracts.find({ where: { id: In(ids) } }),
      this.fundings.find({ where: { contract_id: In(ids) } }),
      this.payments
        .createQueryBuilder('payment')
        .select('payment.contract_id', 'contract_id')
        .addSelect('payment.amount', 'amount')
        .addSelect(`to_char(payment.payment_date, 'YYYY-MM-DD')`, 'date')
        .addSelect('payment.payment_date = CURRENT_DATE', 'is_today')
        .addSelect(
          `payment.payment_date >= date_trunc('month', CURRENT_DATE)`,
          'is_month',
        )
        .where('payment.contract_id IN (:...ids)', { ids })
        .getRawMany<{
          contract_id: number;
          amount: string;
          date: string;
          is_today: boolean;
          is_month: boolean;
        }>(),
      this.dueToDateBy(ids, window.to),
    ]);

    const asAt = window.to ?? today();
    const inWindow = (date: string) =>
      (!window.from || date >= window.from) &&
      (!window.to || date <= window.to);

    // Paid as at the period's end, which is what every balance is measured
    // against. Without a period that is simply everything paid.
    const paidBy = new Map<number, number>();

    for (const row of payments) {
      if (row.date > asAt) continue;

      paidBy.set(
        row.contract_id,
        (paidBy.get(row.contract_id) ?? 0) + toPaisa(row.amount),
      );
    }

    const stakesBy = new Map<number, FundingRow[]>();

    for (const row of stakes) {
      const list = stakesBy.get(row.contract_id) ?? [];

      list.push({
        investor_id: row.investor_id,
        amount: toPaisa(row.amount),
        share_pct: row.share_pct,
        funded_from_principal: toPaisa(row.funded_from_principal),
        funded_from_profit: toPaisa(row.funded_from_profit),
      });
      stakesBy.set(row.contract_id, list);
    }

    /** This investor's fraction of a contract, by amount against cost. */
    const fraction = new Map<number, number>();

    for (const contract of contracts) {
      const mine = stakesBy
        .get(contract.id)
        ?.find((row) => row.investor_id === investorId);
      const cost = toPaisa(contract.cost_price);

      fraction.set(contract.id, mine && cost > 0 ? mine.amount / cost : 0);
    }

    const collections = { today: 0, month: 0, all_time: 0, period: 0 };

    for (const row of payments) {
      const share = Math.round(
        toPaisa(row.amount) * (fraction.get(row.contract_id) ?? 0),
      );

      collections.all_time += share;
      if (row.is_month) collections.month += share;
      if (row.is_today) collections.today += share;
      if (inWindow(row.date)) collections.period += share;
    }

    let outstanding = 0;
    let mature = 0;
    let unmatured = 0;
    let activePlans = 0;
    let pastDue = 0;
    let started = 0;
    const customers = new Set<number>();

    for (const contract of contracts) {
      // Stocks: only contracts that existed at the period's end.
      if (contract.start_date > asAt) continue;

      const paid = paidBy.get(contract.id) ?? 0;

      // Flows: the contracts and customers that arrived inside the period.
      if (inWindow(contract.start_date)) {
        started += 1;
        customers.add(contract.customer_id);
        if (contract.status === ContractStatus.active) activePlans += 1;
      }

      if (contract.status === ContractStatus.active) {
        outstanding += Math.round(
          outstandingOf(toPaisa(contract.financed_amount), paid) *
            (fraction.get(contract.id) ?? 0),
        );

        if ((dueToDate.get(contract.id) ?? 0) > paid) pastDue += 1;
      }

      const share = splitRecovery(
        {
          down_payment: contract.down_payment,
          paid,
          markup_amount: contract.markup_amount,
          cost_price: contract.cost_price,
        },
        stakesBy.get(contract.id) ?? [],
      ).shares.find((row) => row.investor_id === investorId);

      mature += share?.matured_profit ?? 0;
      unmatured += share?.unmatured_profit ?? 0;
    }

    return {
      investor: named,
      period,
      net_capital,
      collections: {
        today: toAmount(collections.today),
        month: toAmount(collections.month),
        all_time: toAmount(collections.all_time),
        period: window.from || window.to ? toAmount(collections.period) : null,
      },
      outstanding: toAmount(outstanding),
      mature_profit: toAmount(mature),
      unmatured_profit: toAmount(unmatured),
      counts: {
        active_plans: activePlans,
        customers: customers.size,
        contracts: started,
        investors: 1,
        active_investors: activeInvestor,
      },
      recent_payments: await this.recentPayments(ids, window),
      past_due_contracts: pastDue,
      rates: await this.rates(window, ids, fraction),
      collections_by_month: await this.collectionsByMonth(investorId, window),
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * FR-DSH-15. Each investor's share of what came in, by month.
   *
   * A payment on a jointly funded contract is split between its funders by
   * the amounts they put in against cost price (BR-26), the same weighting
   * the tiles and the funding register use, so the chart's total for a month
   * is the month's collections and no more. Every month in the span is
   * present even at zero, so the x-axis is a calendar and not a list of the
   * days somebody happened to pay.
   */
  private async collectionsByMonth(
    investorId: number | undefined,
    window: Window,
  ): Promise<DashboardResponse['collections_by_month']> {
    const months = monthsOf(window);
    // The period's own bounds when it has them, so a chart for the 8th shows
    // the 8th and not the whole of September; otherwise the span of months.
    // The upper bound is exclusive: the day after the period ends, or the
    // first day of the following month, since "the 31st" is not a day every
    // month has.
    const from = window.from ?? `${months[0]}-01`;
    const [endYear, endMonth] = months[months.length - 1]
      .split('-')
      .map(Number);
    const until = window.to
      ? new Date(
          Date.UTC(endYear, endMonth - 1, Number(window.to.slice(8, 10)) + 1),
        )
          .toISOString()
          .slice(0, 10)
      : new Date(Date.UTC(endYear, endMonth, 1)).toISOString().slice(0, 10);

    const stakes = await this.fundings.find({
      select: { contract_id: true, investor_id: true, amount: true },
      relations: { contract: true, investor: true },
    });

    /** Fraction of each contract per investor, by amount against cost. */
    const fractions = new Map<number, Map<number, number>>();
    const names = new Map<number, string>();

    for (const row of stakes) {
      const cost = toPaisa(row.contract?.cost_price ?? 0);
      const share = cost > 0 ? toPaisa(row.amount) / cost : 0;
      const byInvestor =
        fractions.get(row.contract_id) ?? new Map<number, number>();

      byInvestor.set(row.investor_id, share);
      fractions.set(row.contract_id, byInvestor);
      names.set(row.investor_id, row.investor?.full_name ?? '');
    }

    const payments = await this.payments
      .createQueryBuilder('payment')
      .select('payment.contract_id', 'contract_id')
      .addSelect('payment.amount', 'amount')
      .addSelect(`to_char(payment.payment_date, 'YYYY-MM')`, 'month')
      .where('payment.payment_date >= :from', { from })
      .andWhere('payment.payment_date < :until', { until })
      .getRawMany<{ contract_id: number; amount: string; month: string }>();

    const index = new Map(months.map((month, at) => [month, at]));
    const totals = new Map<number, number[]>();

    for (const row of payments) {
      const at = index.get(row.month);
      const byInvestor = fractions.get(row.contract_id);

      if (at === undefined || !byInvestor) continue;

      for (const [investor, share] of byInvestor) {
        if (investorId !== undefined && investor !== investorId) continue;

        const values = totals.get(investor) ?? months.map(() => 0);

        values[at] += Math.round(toPaisa(row.amount) * share);
        totals.set(investor, values);
      }
    }

    // Every investor who has ever funded anything gets a line, flat or not:
    // a name that vanishes from the legend in a quiet year reads as an error.
    const ids =
      investorId !== undefined
        ? [investorId]
        : [...names.keys()].sort((a, b) =>
            (names.get(a) ?? '').localeCompare(names.get(b) ?? ''),
          );

    return {
      months,
      series: ids.map((id) => ({
        investor_id: id,
        investor_name: names.get(id) ?? '',
        values: (totals.get(id) ?? months.map(() => 0)).map(toAmount),
      })),
    };
  }

  /**
   * FR-DSH-18. One card per funding investor.
   *
   * Each card is the investor's own dashboard read once (twice with a
   * comparison), which keeps the cards and the filtered view in perfect
   * agreement: pick an investor and the tiles say what their card said.
   * Bounded by the eight names the chart can carry.
   */
  private async scorecards(
    window: Window,
    previous?: Window,
    investorId?: number,
  ): Promise<Scorecard[]> {
    // Filtered to one investor, their card and nobody else's — whether or
    // not their money is in a contract yet, since the reader asked for them.
    const funders =
      investorId !== undefined
        ? [{ investor_id: investorId }]
        : await this.fundings
            .createQueryBuilder('funding')
            .select('DISTINCT funding.investor_id', 'investor_id')
            .getRawMany<{ investor_id: number }>();

    const investors = await this.investors.find({
      where: { id: In(funders.map((row) => row.investor_id)) },
      order: { full_name: 'ASC' },
      take: 8,
    });

    return Promise.all(
      investors.map(async (investor) => {
        const [now, before] = await Promise.all([
          this.forInvestor(investor.id, window),
          previous ? this.forInvestor(investor.id, previous) : null,
        ]);

        return {
          investor_id: investor.id,
          investor_name: investor.full_name,
          status: investor.status,
          contracts: now.counts.contracts,
          net_capital: now.net_capital,
          collected: now.collections.period ?? now.collections.all_time,
          collected_before: before
            ? (before.collections.period ?? before.collections.all_time)
            : null,
          outstanding: now.outstanding,
          mature_profit: now.mature_profit,
          on_time: now.rates.on_time,
          collection: now.rates.collection,
        };
      }),
    );
  }

  /**
   * FR-DSH-20. The portfolio as percentages.
   *
   * Promptness is read off the schedule the way a customer experiences it:
   * installment *n* was paid on time if, by its due date, the contract had
   * received at least the sum of installments 1..n. Payments are lump sums
   * against a contract, not receipts for a numbered installment, so this
   * running comparison is the only honest reading — a customer who pays two
   * months at once is on time for both, and one who pays half is late for one.
   *
   * For one investor, contract amounts are weighted by their stake (BR-26);
   * a count of installments is not, since an installment is either on time
   * or it is not, whoever funded it.
   */
  private async rates(
    window: Window,
    contractIds?: number[],
    fraction?: Map<number, number>,
  ): Promise<Rates> {
    const asAt = window.to ?? today();
    const share = (contractId: number) =>
      fraction ? (fraction.get(contractId) ?? 0) : 1;

    if (contractIds && contractIds.length === 0) {
      const none = { numerator: '0.00', denominator: '0.00', pct: null };

      return {
        on_time: { numerator: '0', denominator: '0', pct: null },
        collection: none,
        recovered: none,
        profit_matured: none,
        past_due: { numerator: '0', denominator: '0', pct: null },
      };
    }

    const scope = <T extends { andWhere: (q: string, p?: object) => T }>(
      qb: T,
      column: string,
    ): T =>
      contractIds
        ? qb.andWhere(`${column} IN (:...ids)`, { ids: contractIds })
        : qb;

    const [contracts, installments, payments] = await Promise.all([
      scope(
        this.contracts
          .createQueryBuilder('contract')
          .select('contract.id', 'id')
          .addSelect('contract.status', 'status')
          .addSelect('contract.financed_amount', 'financed_amount')
          .addSelect('contract.markup_amount', 'markup_amount')
          .addSelect('contract.sale_price', 'sale_price')
          .addSelect('contract.down_payment', 'down_payment')
          .where('contract.start_date <= :asAt', { asAt }),
        'contract.id',
      ).getRawMany<{
        id: number;
        status: ContractStatus;
        financed_amount: string;
        markup_amount: string;
        sale_price: string;
        down_payment: string;
      }>(),
      scope(
        this.contracts.manager
          .createQueryBuilder(Installment, 'i')
          .select('i.contract_id', 'contract_id')
          .addSelect(`to_char(i.due_date, 'YYYY-MM-DD')`, 'due_date')
          .addSelect('i.amount', 'amount')
          .where('i.due_date <= :asAt', { asAt })
          .orderBy('i.contract_id')
          .addOrderBy('i.due_date')
          .addOrderBy('i.seq'),
        'i.contract_id',
      ).getRawMany<{ contract_id: number; due_date: string; amount: string }>(),
      scope(
        this.payments
          .createQueryBuilder('payment')
          .select('payment.contract_id', 'contract_id')
          .addSelect(`to_char(payment.payment_date, 'YYYY-MM-DD')`, 'date')
          .addSelect('payment.amount', 'amount')
          .where('payment.payment_date <= :asAt', { asAt })
          .orderBy('payment.payment_date')
          .addOrderBy('payment.id'),
        'payment.contract_id',
      ).getRawMany<{ contract_id: number; date: string; amount: string }>(),
    ]);

    const inWindow = (date: string) => !window.from || date >= window.from;

    const paymentsBy = new Map<number, { date: string; amount: number }[]>();

    for (const row of payments) {
      const list = paymentsBy.get(row.contract_id) ?? [];

      list.push({ date: row.date, amount: toPaisa(row.amount) });
      paymentsBy.set(row.contract_id, list);
    }

    /** Everything paid on a contract by the period's end. */
    const paidByEnd = new Map<number, number>();

    for (const [contractId, list] of paymentsBy) {
      paidByEnd.set(
        contractId,
        list.reduce((sum, payment) => sum + payment.amount, 0),
      );
    }

    // On time, and covered against due, over the installments in the window.
    // Both read the schedule cumulatively: installment n is met once the
    // contract has received the sum of installments 1..n.
    let dueCount = 0;
    let onTime = 0;
    let dueAmount = 0;
    let coveredAmount = 0;
    const running = new Map<number, number>();

    for (const row of installments) {
      const amount = toPaisa(row.amount);
      const before = running.get(row.contract_id) ?? 0;
      const cumulative = before + amount;

      running.set(row.contract_id, cumulative);

      if (!inWindow(row.due_date)) continue;

      const weight = share(row.contract_id);

      dueCount += 1;
      dueAmount += Math.round(amount * weight);

      const paidByDue = (paymentsBy.get(row.contract_id) ?? [])
        .filter((payment) => payment.date <= row.due_date)
        .reduce((sum, payment) => sum + payment.amount, 0);

      if (paidByDue >= cumulative) onTime += 1;

      // How much of this installment the money received by the period's end
      // reaches, once the ones before it are met.
      const covered = Math.min(
        amount,
        Math.max(0, (paidByEnd.get(row.contract_id) ?? 0) - before),
      );

      coveredAmount += Math.round(covered * weight);
    }

    let collectedEver = 0;

    for (const row of payments) {
      collectedEver += Math.round(toPaisa(row.amount) * share(row.contract_id));
    }

    // Recovered and profit, as at the end, over live contracts.
    let financed = 0;
    let markup = 0;
    let mature = 0;
    let active = 0;
    let pastDue = 0;
    const dueToDate = await this.dueToDateBy(
      contracts.map((row) => row.id),
      window.to,
    );

    for (const row of contracts) {
      if (row.status === ContractStatus.cancelled) continue;

      const weight = share(row.id);
      const paid = (paymentsBy.get(row.id) ?? []).reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );

      financed += Math.round(toPaisa(row.financed_amount) * weight);
      markup += Math.round(toPaisa(row.markup_amount) * weight);
      mature += Math.round(
        matureProfit({
          sale_price: row.sale_price,
          down_payment: row.down_payment,
          markup_amount: row.markup_amount,
          paid,
        }).mature * weight,
      );

      if (row.status === ContractStatus.active) {
        active += 1;
        if ((dueToDate.get(row.id) ?? 0) > paid) pastDue += 1;
      }
    }

    return {
      on_time: {
        numerator: String(onTime),
        denominator: String(dueCount),
        pct: pct(onTime, dueCount),
      },
      collection: {
        numerator: toAmount(coveredAmount),
        denominator: toAmount(dueAmount),
        pct: pct(coveredAmount, dueAmount),
      },
      recovered: {
        numerator: toAmount(collectedEver),
        denominator: toAmount(financed),
        pct: pct(collectedEver, financed),
      },
      profit_matured: {
        numerator: toAmount(mature),
        denominator: toAmount(markup),
        pct: pct(mature, markup),
      },
      past_due: {
        numerator: String(pastDue),
        denominator: String(active),
        pct: pct(pastDue, active),
      },
    };
  }

  /**
   * FR-DSH-19. Collections by payment method inside the period, or all time
   * without one. For one investor, their share of each payment (BR-26).
   */
  private async collectionsByMethod(
    window: Window,
    investorId?: number,
  ): Promise<DashboardResponse['collections_by_method']> {
    const qb = this.payments
      .createQueryBuilder('payment')
      .select('payment.method', 'method')
      .addSelect('payment.contract_id', 'contract_id')
      .addSelect('payment.amount', 'amount');

    if (window.from) {
      qb.andWhere('payment.payment_date >= :from', { from: window.from });
    }

    if (window.to) {
      qb.andWhere('payment.payment_date <= :to', { to: window.to });
    }

    const rows = await qb.getRawMany<{
      method: string;
      contract_id: number;
      amount: string;
    }>();

    const fraction = new Map<number, number>();

    if (investorId !== undefined) {
      const stakes = await this.fundings.find({
        where: { investor_id: investorId },
        relations: { contract: true },
      });

      for (const row of stakes) {
        const cost = toPaisa(row.contract?.cost_price ?? 0);

        fraction.set(
          row.contract_id,
          cost > 0 ? toPaisa(row.amount) / cost : 0,
        );
      }
    }

    const totals = new Map<string, { amount: number; count: number }>();

    for (const row of rows) {
      const share =
        investorId === undefined ? 1 : (fraction.get(row.contract_id) ?? 0);

      if (share === 0) continue;

      const entry = totals.get(row.method) ?? { amount: 0, count: 0 };

      entry.amount += Math.round(toPaisa(row.amount) * share);
      entry.count += 1;
      totals.set(row.method, entry);
    }

    return [...totals.entries()]
      .map(([method, entry]) => ({
        method,
        amount: toAmount(entry.amount),
        count: entry.count,
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
  }

  /** Installments fallen due by the given day (default today), per contract. */
  private async dueToDateBy(
    ids: number[],
    asAt?: string,
  ): Promise<Map<number, number>> {
    // `IN ()` is a syntax error, and a period before the first contract
    // has nothing to ask about.
    if (ids.length === 0) return new Map();

    const rows = await this.contracts.manager
      .createQueryBuilder(Installment, 'i')
      .select('i.contract_id', 'contract_id')
      .addSelect('COALESCE(SUM(i.amount), 0)', 'due')
      .where('i.contract_id IN (:...ids)', { ids })
      .andWhere(
        asAt ? 'i.due_date < :asAt' : 'i.due_date < CURRENT_DATE',
        asAt ? { asAt } : {},
      )
      .groupBy('i.contract_id')
      .getRawMany<{ contract_id: number; due: string }>();

    return new Map(rows.map((row) => [row.contract_id, toPaisa(row.due)]));
  }

  /**
   * FR-DSH-01..03 and FR-DSH-16. Four windows in one pass, using FILTER
   * rather than four scans of the same table. Dates are compared in the
   * database so "today" means today on the server, not on whichever machine
   * asked.
   */
  private async collections(
    window: Window,
  ): Promise<DashboardResponse['collections']> {
    const periodFilter = [
      window.from ? 'payment.payment_date >= :from' : null,
      window.to ? 'payment.payment_date <= :to' : null,
    ]
      .filter(Boolean)
      .join(' AND ');

    const row = await this.payments
      .createQueryBuilder('payment')
      .select(
        `COALESCE(SUM(payment.amount) FILTER (WHERE payment.payment_date = CURRENT_DATE), 0)`,
        'today',
      )
      .addSelect(
        `COALESCE(SUM(payment.amount) FILTER (WHERE payment.payment_date >= date_trunc('month', CURRENT_DATE)), 0)`,
        'month',
      )
      .addSelect(`COALESCE(SUM(payment.amount), 0)`, 'all_time')
      .addSelect(
        periodFilter
          ? `COALESCE(SUM(payment.amount) FILTER (WHERE ${periodFilter}), 0)`
          : 'NULL',
        'period',
      )
      .setParameters({ from: window.from, to: window.to })
      // Voided payments are soft-deleted, and TypeORM excludes them here —
      // which is exactly right: a void must not count as money collected.
      .getRawOne<{
        today: string;
        month: string;
        all_time: string;
        period: string | null;
      }>();

    return {
      today: toAmount(toPaisa(row?.today ?? 0)),
      month: toAmount(toPaisa(row?.month ?? 0)),
      all_time: toAmount(toPaisa(row?.all_time ?? 0)),
      period: periodFilter && row ? toAmount(toPaisa(row.period ?? 0)) : null,
    };
  }

  /**
   * FR-DSH-04-v2 and FR-DSH-10-v2. Outstanding and profit maturity need the
   * same per-contract paid total, so they come from one query and are then
   * folded through the tested formulas rather than reimplemented in SQL.
   *
   * Outstanding counts **active** contracts only — a completed plan owes
   * nothing and a cancelled one is not being collected. Profit maturity counts
   * every live contract: what matured before a contract completed or was
   * cancelled was still earned.
   *
   * With a period, both are as at its last day: contracts that had started
   * by then, and what had been paid on them by then.
   */
  private async portfolioMoney(window: Window): Promise<{
    outstanding: string;
    mature: string;
    unmatured: string;
  }> {
    const qb = this.contracts
      .createQueryBuilder('contract')
      .select('contract.id', 'id')
      .addSelect('contract.status', 'status')
      .addSelect('contract.sale_price', 'sale_price')
      .addSelect('contract.down_payment', 'down_payment')
      .addSelect('contract.markup_amount', 'markup_amount')
      .addSelect('contract.financed_amount', 'financed_amount')
      .addSelect(
        (sub) =>
          sub
            .select('COALESCE(SUM(p.amount), 0)')
            .from(Payment, 'p')
            .where('p.contract_id = contract.id')
            .andWhere('p.deleted_at IS NULL')
            .andWhere(window.to ? 'p.payment_date <= :to' : 'TRUE'),
        'paid',
      );

    if (window.to) {
      qb.where('contract.start_date <= :to').setParameter('to', window.to);
    }

    const rows = await qb.getRawMany<{
      status: ContractStatus;
      sale_price: string;
      down_payment: string;
      markup_amount: string;
      financed_amount: string;
      paid: string;
    }>();

    let outstanding = 0;
    let mature = 0;
    let unmatured = 0;

    for (const row of rows) {
      const paid = toPaisa(row.paid);

      if (row.status === ContractStatus.active) {
        outstanding += outstandingOf(toPaisa(row.financed_amount), paid);
      }

      const profit = matureProfit({
        sale_price: row.sale_price,
        down_payment: row.down_payment,
        markup_amount: row.markup_amount,
        paid,
      });

      mature += profit.mature;
      unmatured += profit.unmatured;
    }

    return {
      outstanding: toAmount(outstanding),
      mature: toAmount(mature),
      unmatured: toAmount(unmatured),
    };
  }

  /**
   * FR-DSH-05..08. Soft-deleted rows are excluded by TypeORM throughout.
   *
   * With a period: contracts started inside it, the active ones among them,
   * and customers added inside it. Investors are the register as it stands.
   */
  private async counts(window: Window): Promise<DashboardResponse['counts']> {
    const contractsIn = this.contracts.createQueryBuilder('contract');
    const customersIn = this.customers.createQueryBuilder('customer');

    if (window.from) {
      contractsIn.andWhere('contract.start_date >= :from', {
        from: window.from,
      });
      customersIn.andWhere('customer.created_at >= :from', {
        from: window.from,
      });
    }

    if (window.to) {
      contractsIn.andWhere('contract.start_date <= :to', { to: window.to });
      customersIn.andWhere(`customer.created_at < :to::date + 1`, {
        to: window.to,
      });
    }

    const [active_plans, customers, contracts, investors, active_investors] =
      await Promise.all([
        contractsIn
          .clone()
          .andWhere('contract.status = :status', {
            status: ContractStatus.active,
          })
          .getCount(),
        customersIn.getCount(),
        contractsIn.getCount(),
        this.investors.count(),
        this.investors.countBy({ status: InvestorStatus.active }),
      ]);

    return {
      active_plans,
      customers,
      contracts,
      investors,
      active_investors,
    };
  }

  /** FR-DSH-09. Narrowed to the given contracts and period when given. */
  private async recentPayments(
    contractIds: number[] | undefined,
    window: Window,
  ): Promise<RecentPayment[]> {
    const qb = this.payments
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.contract', 'contract')
      .leftJoinAndSelect('contract.customer', 'customer')
      .leftJoinAndSelect('contract.product', 'product')
      .orderBy('payment.payment_date', 'DESC')
      .addOrderBy('payment.id', 'DESC')
      .take(5);

    if (contractIds) {
      qb.andWhere('payment.contract_id IN (:...ids)', { ids: contractIds });
    }

    if (window.from) {
      qb.andWhere('payment.payment_date >= :from', { from: window.from });
    }

    if (window.to) {
      qb.andWhere('payment.payment_date <= :to', { to: window.to });
    }

    const rows = await qb.getMany();

    return rows.map((payment) => ({
      id: payment.id,
      contract_id: payment.contract_id,
      customer_name: payment.contract?.customer?.full_name ?? '',
      product_name: payment.contract?.product?.name ?? '',
      amount: payment.amount,
      payment_date: payment.payment_date,
      method: payment.method,
    }));
  }

  /**
   * FR-DSH-12. The same reading as the register's `past_due` filter, done in
   * SQL for the same reason: what the strip counts and what the filtered list
   * shows must be one query's worth of truth, not two implementations.
   *
   * With a period, as at its last day: what had fallen due by then against
   * what had been paid by then.
   */
  private async pastDueCount(window: Window): Promise<number> {
    const qb = this.contracts.createQueryBuilder('contract');
    const asAt = window.to;

    const paid = qb
      .subQuery()
      .select('COALESCE(SUM(p.amount), 0)')
      .from(Payment, 'p')
      .where('p.contract_id = contract.id')
      .andWhere('p.deleted_at IS NULL')
      .andWhere(asAt ? 'p.payment_date <= :asAt' : 'TRUE')
      .getQuery();

    const dueToDate = qb
      .subQuery()
      .select('COALESCE(SUM(i.amount), 0)')
      .from(Installment, 'i')
      .where('i.contract_id = contract.id')
      .andWhere(asAt ? 'i.due_date < :asAt' : 'i.due_date < CURRENT_DATE')
      .getQuery();

    qb.where('contract.status = :status', { status: ContractStatus.active });

    if (asAt) {
      qb.andWhere('contract.start_date <= :asAt').setParameter('asAt', asAt);
    }

    return qb.andWhere(`${dueToDate} > ${paid}`).getCount();
  }
}
