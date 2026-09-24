import { Injectable, NotFoundException } from '@nestjs/common';
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

/** FR-DSH-01..12. One payload; the whole screen renders from it. */
export type DashboardResponse = {
  /**
   * FR-DSH-13. Set when the figures below are one investor's, null for the
   * whole portfolio.
   */
  investor: { id: number; full_name: string } | null;
  /** BR-24. Deposits less withdrawals, adjustments and losses. */
  net_capital: string;
  collections: { today: string; month: string; all_time: string };
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
  generated_at: string;
};

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

  async summary(investorId?: number): Promise<DashboardResponse> {
    if (investorId !== undefined) return this.forInvestor(investorId);

    const [collections, money, counts, recent, past_due_contracts, position] =
      await Promise.all([
        this.collections(),
        this.portfolioMoney(),
        this.counts(),
        this.recentPayments(),
        this.pastDueCount(),
        this.investorsService.portfolioPosition(),
      ]);

    return {
      investor: null,
      net_capital: position.net_principal,
      collections,
      outstanding: money.outstanding,
      mature_profit: money.mature,
      unmatured_profit: money.unmatured,
      counts,
      recent_payments: recent,
      past_due_contracts,
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
  private async forInvestor(investorId: number): Promise<DashboardResponse> {
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
    const position = await this.investorsService.findOne(investorId);
    const named = { id: investor.id, full_name: investor.full_name };
    const activeInvestor = investor.status === InvestorStatus.active ? 1 : 0;

    if (ids.length === 0) {
      return {
        investor: named,
        net_capital: position.balances.net_principal,
        collections: { today: '0.00', month: '0.00', all_time: '0.00' },
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
        .addSelect('payment.payment_date = CURRENT_DATE', 'is_today')
        .addSelect(
          `payment.payment_date >= date_trunc('month', CURRENT_DATE)`,
          'is_month',
        )
        .where('payment.contract_id IN (:...ids)', { ids })
        .getRawMany<{
          contract_id: number;
          amount: string;
          is_today: boolean;
          is_month: boolean;
        }>(),
      this.dueToDateBy(ids),
    ]);

    const paidBy = new Map<number, number>();

    for (const row of payments) {
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

    const collections = { today: 0, month: 0, all_time: 0 };

    for (const row of payments) {
      const share = Math.round(
        toPaisa(row.amount) * (fraction.get(row.contract_id) ?? 0),
      );

      collections.all_time += share;
      if (row.is_month) collections.month += share;
      if (row.is_today) collections.today += share;
    }

    let outstanding = 0;
    let mature = 0;
    let unmatured = 0;
    let activePlans = 0;
    let pastDue = 0;
    const customers = new Set<number>();

    for (const contract of contracts) {
      const paid = paidBy.get(contract.id) ?? 0;

      customers.add(contract.customer_id);

      if (contract.status === ContractStatus.active) {
        activePlans += 1;
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
      net_capital: position.balances.net_principal,
      collections: {
        today: toAmount(collections.today),
        month: toAmount(collections.month),
        all_time: toAmount(collections.all_time),
      },
      outstanding: toAmount(outstanding),
      mature_profit: toAmount(mature),
      unmatured_profit: toAmount(unmatured),
      counts: {
        active_plans: activePlans,
        customers: customers.size,
        contracts: contracts.length,
        investors: 1,
        active_investors: activeInvestor,
      },
      recent_payments: await this.recentPayments(ids),
      past_due_contracts: pastDue,
      generated_at: new Date().toISOString(),
    };
  }

  /** Installments fallen due to date, per contract, in paisa. */
  private async dueToDateBy(ids: number[]): Promise<Map<number, number>> {
    const rows = await this.contracts.manager
      .createQueryBuilder(Installment, 'i')
      .select('i.contract_id', 'contract_id')
      .addSelect('COALESCE(SUM(i.amount), 0)', 'due')
      .where('i.contract_id IN (:...ids)', { ids })
      .andWhere('i.due_date < CURRENT_DATE')
      .groupBy('i.contract_id')
      .getRawMany<{ contract_id: number; due: string }>();

    return new Map(rows.map((row) => [row.contract_id, toPaisa(row.due)]));
  }

  /**
   * FR-DSH-01..03. Three windows in one pass, using FILTER rather than three
   * scans of the same table. Dates are compared in the database so "today"
   * means today on the server, not on whichever machine asked.
   */
  private async collections(): Promise<DashboardResponse['collections']> {
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
      // Voided payments are soft-deleted, and TypeORM excludes them here —
      // which is exactly right: a void must not count as money collected.
      .getRawOne<{ today: string; month: string; all_time: string }>();

    return {
      today: toAmount(toPaisa(row?.today ?? 0)),
      month: toAmount(toPaisa(row?.month ?? 0)),
      all_time: toAmount(toPaisa(row?.all_time ?? 0)),
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
   */
  private async portfolioMoney(): Promise<{
    outstanding: string;
    mature: string;
    unmatured: string;
  }> {
    const rows = await this.contracts
      .createQueryBuilder('contract')
      .select('contract.id', 'id')
      .addSelect('contract.status', 'status')
      .addSelect('contract.sale_price', 'sale_price')
      .addSelect('contract.down_payment', 'down_payment')
      .addSelect('contract.markup_amount', 'markup_amount')
      .addSelect('contract.financed_amount', 'financed_amount')
      .addSelect(
        (qb) =>
          qb
            .select('COALESCE(SUM(p.amount), 0)')
            .from(Payment, 'p')
            .where('p.contract_id = contract.id')
            .andWhere('p.deleted_at IS NULL'),
        'paid',
      )
      .getRawMany<{
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

  /** FR-DSH-05..08. Soft-deleted rows are excluded by TypeORM throughout. */
  private async counts(): Promise<DashboardResponse['counts']> {
    const [active_plans, customers, contracts, investors, active_investors] =
      await Promise.all([
        this.contracts.countBy({ status: ContractStatus.active }),
        this.customers.count(),
        this.contracts.count(),
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

  /** FR-DSH-09. Narrowed to the given contracts when any are given. */
  private async recentPayments(
    contractIds?: number[],
  ): Promise<RecentPayment[]> {
    const rows = await this.payments.find({
      where: contractIds ? { contract_id: In(contractIds) } : {},
      relations: { contract: { customer: true, product: true } },
      order: { payment_date: 'DESC', id: 'DESC' },
      take: 5,
    });

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
   */
  private async pastDueCount(): Promise<number> {
    const qb = this.contracts.createQueryBuilder('contract');

    const paid = qb
      .subQuery()
      .select('COALESCE(SUM(p.amount), 0)')
      .from(Payment, 'p')
      .where('p.contract_id = contract.id')
      .andWhere('p.deleted_at IS NULL')
      .getQuery();

    const dueToDate = qb
      .subQuery()
      .select('COALESCE(SUM(i.amount), 0)')
      .from(Installment, 'i')
      .where('i.contract_id = contract.id')
      .andWhere('i.due_date < CURRENT_DATE')
      .getQuery();

    return qb
      .where('contract.status = :status', { status: ContractStatus.active })
      .andWhere(`${dueToDate} > ${paid}`)
      .getCount();
  }
}
