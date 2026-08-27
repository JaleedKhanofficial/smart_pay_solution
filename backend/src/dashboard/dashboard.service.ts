import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractStatus, ProductStatus } from '../common/enums';
import {
  Contract,
  Customer,
  Installment,
  Payment,
  Product,
} from '../database/entities';
import { matureProfit, outstandingOf, toAmount, toPaisa } from '../formulas';

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
  collections: { today: string; month: string; all_time: string };
  /** FR-DSH-04-v2. Markup included, so it agrees with the contract screen. */
  outstanding: string;
  /** FR-DSH-10-v2 / BR-09. */
  mature_profit: string;
  unmatured_profit: string;
  counts: {
    active_plans: number;
    active_products: number;
    customers: number;
    contracts: number;
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
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
  ) {}

  async summary(): Promise<DashboardResponse> {
    const [collections, money, counts, recent, past_due_contracts] =
      await Promise.all([
        this.collections(),
        this.portfolioMoney(),
        this.counts(),
        this.recentPayments(),
        this.pastDueCount(),
      ]);

    return {
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
    const [active_plans, active_products, customers, contracts] =
      await Promise.all([
        this.contracts.countBy({ status: ContractStatus.active }),
        this.products.countBy({ status: ProductStatus.Active }),
        this.customers.count(),
        this.contracts.count(),
      ]);

    return { active_plans, active_products, customers, contracts };
  }

  /** FR-DSH-09 */
  private async recentPayments(): Promise<RecentPayment[]> {
    const rows = await this.payments.find({
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
