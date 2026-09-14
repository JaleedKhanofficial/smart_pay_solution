import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ContractStatus } from '../common/enums';
import { toFundingRow } from '../contracts/funding.service';
import {
  Contract,
  ContractFunding,
  Investor,
  Payment,
} from '../database/entities';
import { splitRecovery, toAmount, toPaisa } from '../formulas';
import {
  type Arrangement,
  type FundingReportQueryDto,
} from './dto/funding-report-query.dto';

/** FR-IVT-16. One investor's stake in one contract, and what it has returned. */
export type FundingStake = {
  investor_id: number;
  investor_name: string;
  amount: string;
  /** BR-15. Of the contract's cost price. Always 100 on a sole deal. */
  share_pct: string;
  funded_from_principal: string;
  funded_from_profit: string;
  /** BR-23. Drawn on recovered profit rather than fresh principal. */
  reinvested: boolean;
  /** BR-18. Their capital that has come home so far. */
  capital_recovered: string;
  /** What is still out on this contract. */
  capital_outstanding: string;
  /** BR-09. Profit earned, which only exists once capital is whole. */
  matured_profit: string;
  /** Their share of the markup that has yet to be earned. */
  unmatured_profit: string;
};

/** FR-IVT-16. One funded contract, and who is behind it. */
export type FundingReportRow = {
  contract_id: number;
  reference: string;
  customer_name: string;
  product_name: string;
  status: ContractStatus;
  /** True while the contract sits in the Recycle Bin. */
  deleted: boolean;
  start_date: string;
  end_date: string;
  cost_price: string;
  markup_amount: string;
  /** `sole` when one investor bought the unit, `joint` when several did. */
  arrangement: Arrangement;
  investor_count: number;
  /** Σ of the stakes, which equals the cost price (FR-CON-13 as built). */
  funded: string;
  /** Down payment plus every non-voided payment. */
  recovered: string;
  capital_recovered: string;
  capital_outstanding: string;
  /** BR-09. Earned: this deal has returned the capital that was put in. */
  matured_profit: string;
  /** Their share of the markup this deal has yet to earn. */
  unmatured_profit: string;
  stakes: FundingStake[];
};

/** FR-IVT-16. One investor across every deal they are in. */
export type InvestorFundingRollup = {
  investor_id: number;
  investor_name: string;
  contracts: number;
  /** Deals they funded alone, and deals they share with someone. */
  sole: number;
  joint: number;
  funded: string;
  capital_recovered: string;
  capital_outstanding: string;
  matured_profit: string;
  unmatured_profit: string;
};

export type FundingReportTotals = {
  contracts: number;
  sole: number;
  joint: number;
  investors: number;
  funded: string;
  capital_recovered: string;
  capital_outstanding: string;
  matured_profit: string;
  unmatured_profit: string;
};

export type FundingReportResponse = {
  rows: FundingReportRow[];
  investors: InvestorFundingRollup[];
  totals: FundingReportTotals;
  generated_at: string;
};

/**
 * FR-IVT-16. The funding register: which contracts investor money bought,
 * and whether each was bought by one investor or several between them.
 *
 * Its own service rather than another method on `ReportsService`, which is
 * already long: this reads the funding rows and the payments behind them, and
 * shares nothing with the summary workbook but the formula package.
 *
 * **Nothing here is stored.** Every recovery figure is derived through
 * `splitRecovery`, the same function the investor register and BR-20 use, so
 * this report cannot disagree with an investor's own balance page.
 */
@Injectable()
export class FundingReportService {
  constructor(
    @InjectRepository(ContractFunding)
    private readonly fundings: Repository<ContractFunding>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Investor)
    private readonly investors: Repository<Investor>,
  ) {}

  async report(query: FundingReportQueryDto): Promise<FundingReportResponse> {
    const rows = await this.allRows();
    const matching = this.applyFilters(rows, query);

    return {
      rows: this.applySort(matching, query),
      // The rollup follows the filtered rows, so narrowing to one investor
      // shows that investor's position across the deals on screen rather than
      // a portfolio figure the table below does not add up to.
      investors: this.rollup(matching),
      totals: this.totals(matching),
      generated_at: new Date().toISOString(),
    };
  }

  // ------------------------------------------------------------ reading --

  /**
   * Every funded contract, in four queries regardless of size: the funding
   * rows, the contracts they name, those contracts' payments, and the
   * investors behind them.
   */
  private async allRows(): Promise<FundingReportRow[]> {
    const fundings = await this.fundings.find({ order: { id: 'ASC' } });

    if (fundings.length === 0) return [];

    const contractIds = [...new Set(fundings.map((row) => row.contract_id))];
    const investorIds = [...new Set(fundings.map((row) => row.investor_id))];

    // `withDeleted` on both: a contract in the Recycle Bin still has capital
    // in it, and an investor who has been removed is still owed what their
    // funding has not returned. Leaving either out would drop a live stake.
    const [contracts, payments, investors] = await Promise.all([
      this.contracts.find({
        where: { id: In(contractIds) },
        relations: { customer: true, product: true },
        withDeleted: true,
      }),
      this.payments.find({
        where: { contract_id: In(contractIds), deleted_at: IsNull() },
        select: { id: true, contract_id: true, amount: true },
      }),
      this.investors.find({
        where: { id: In(investorIds) },
        select: { id: true, full_name: true },
        withDeleted: true,
      }),
    ]);

    const byContract = new Map(contracts.map((row) => [row.id, row]));
    const names = new Map(investors.map((row) => [row.id, row.full_name]));

    const paidBy = new Map<number, number>();

    for (const payment of payments) {
      paidBy.set(
        payment.contract_id,
        (paidBy.get(payment.contract_id) ?? 0) + toPaisa(payment.amount),
      );
    }

    const grouped = new Map<number, ContractFunding[]>();

    for (const row of fundings) {
      grouped.set(row.contract_id, [
        ...(grouped.get(row.contract_id) ?? []),
        row,
      ]);
    }

    const rows: FundingReportRow[] = [];

    for (const [contractId, lines] of grouped) {
      const contract = byContract.get(contractId);

      if (!contract) continue;

      const recovery = splitRecovery(
        {
          down_payment: contract.down_payment,
          paid: paidBy.get(contractId) ?? 0,
          markup_amount: contract.markup_amount,
          cost_price: contract.cost_price,
        },
        lines.map(toFundingRow),
      );

      let capitalRecovered = 0;
      let capitalOutstanding = 0;
      let maturedProfit = 0;
      let unmaturedProfit = 0;
      let funded = 0;

      const stakes = lines.map((line, index) => {
        const share = recovery.shares[index];
        const amount = toPaisa(line.amount);
        const outstanding = Math.max(0, amount - share.capital_recovered);

        funded += amount;
        capitalRecovered += share.capital_recovered;
        capitalOutstanding += outstanding;
        maturedProfit += share.matured_profit;
        unmaturedProfit += share.unmatured_profit;

        return {
          investor_id: line.investor_id,
          investor_name: names.get(line.investor_id) ?? '',
          amount: line.amount,
          share_pct: line.share_pct,
          funded_from_principal: line.funded_from_principal,
          funded_from_profit: line.funded_from_profit,
          reinvested: toPaisa(line.funded_from_profit) > 0,
          capital_recovered: toAmount(share.capital_recovered),
          capital_outstanding: toAmount(outstanding),
          matured_profit: toAmount(share.matured_profit),
          unmatured_profit: toAmount(share.unmatured_profit),
        };
      });

      rows.push({
        contract_id: contractId,
        reference: `SPS-${String(contractId).padStart(4, '0')}`,
        customer_name: contract.customer?.full_name ?? '',
        product_name: contract.product?.name ?? '',
        status: contract.status,
        deleted: contract.deleted_at !== null,
        start_date: contract.start_date,
        end_date: contract.end_date,
        cost_price: contract.cost_price,
        markup_amount: contract.markup_amount,
        // One funder is a sole deal however large; two or more is joint,
        // whatever the split between them.
        arrangement: lines.length === 1 ? 'sole' : 'joint',
        investor_count: lines.length,
        funded: toAmount(funded),
        recovered: toAmount(recovery.recovered),
        capital_recovered: toAmount(capitalRecovered),
        capital_outstanding: toAmount(capitalOutstanding),
        matured_profit: toAmount(maturedProfit),
        unmatured_profit: toAmount(unmaturedProfit),
        stakes,
      });
    }

    return rows;
  }

  // ---------------------------------------------------------- narrowing --

  private applyFilters(
    rows: FundingReportRow[],
    query: FundingReportQueryDto,
  ): FundingReportRow[] {
    const needle = query.search?.toLowerCase();

    return rows.filter((row) => {
      if (query.arrangement && row.arrangement !== query.arrangement) {
        return false;
      }

      if (query.status && row.status !== query.status) return false;

      /**
       * Both ends inclusive, compared as `YYYY-MM-DD` strings.
       *
       * Lexicographic order is chronological order for that format, so this
       * needs no Date at all — and parsing one would drag the server's time
       * zone into a question that has nothing to do with clocks.
       */
      if (query.from && row.start_date < query.from) return false;
      if (query.to && row.start_date > query.to) return false;

      if (
        query.investor_id !== undefined &&
        !row.stakes.some((stake) => stake.investor_id === query.investor_id)
      ) {
        return false;
      }

      if (!needle) return true;

      // One box across the three names a person would search by, because a
      // funding register is read to answer "where is so-and-so's money" as
      // often as "who paid for that fridge".
      return (
        row.customer_name.toLowerCase().includes(needle) ||
        row.product_name.toLowerCase().includes(needle) ||
        row.reference.toLowerCase().includes(needle) ||
        row.stakes.some((stake) =>
          stake.investor_name.toLowerCase().includes(needle),
        )
      );
    });
  }

  private applySort(
    rows: FundingReportRow[],
    query: FundingReportQueryDto,
  ): FundingReportRow[] {
    const direction = query.dir === 'asc' ? 1 : -1;

    const value = (row: FundingReportRow): string | number => {
      switch (query.sort) {
        case 'customer_name':
          return row.customer_name.toLowerCase();
        case 'funded':
          return toPaisa(row.funded);
        case 'recovered':
          return toPaisa(row.recovered);
        case 'start_date':
          return row.start_date;
        default:
          return row.contract_id;
      }
    };

    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);

      if (left === right) return a.contract_id - b.contract_id;

      return (left < right ? -1 : 1) * direction;
    });
  }

  // ------------------------------------------------------------ rolling --

  /** FR-IVT-16. The same rows read down the other axis: by investor. */
  private rollup(rows: FundingReportRow[]): InvestorFundingRollup[] {
    const byInvestor = new Map<
      number,
      {
        investor_name: string;
        contracts: number;
        sole: number;
        joint: number;
        funded: number;
        capital_recovered: number;
        capital_outstanding: number;
        matured_profit: number;
        unmatured_profit: number;
      }
    >();

    for (const row of rows) {
      for (const stake of row.stakes) {
        const current = byInvestor.get(stake.investor_id) ?? {
          investor_name: stake.investor_name,
          contracts: 0,
          sole: 0,
          joint: 0,
          funded: 0,
          capital_recovered: 0,
          capital_outstanding: 0,
          matured_profit: 0,
          unmatured_profit: 0,
        };

        current.contracts += 1;
        if (row.arrangement === 'sole') current.sole += 1;
        else current.joint += 1;

        current.funded += toPaisa(stake.amount);
        current.capital_recovered += toPaisa(stake.capital_recovered);
        current.capital_outstanding += toPaisa(stake.capital_outstanding);
        current.matured_profit += toPaisa(stake.matured_profit);
        current.unmatured_profit += toPaisa(stake.unmatured_profit);

        byInvestor.set(stake.investor_id, current);
      }
    }

    return [...byInvestor.entries()]
      .map(([investor_id, entry]) => ({
        investor_id,
        investor_name: entry.investor_name,
        contracts: entry.contracts,
        sole: entry.sole,
        joint: entry.joint,
        funded: toAmount(entry.funded),
        capital_recovered: toAmount(entry.capital_recovered),
        capital_outstanding: toAmount(entry.capital_outstanding),
        matured_profit: toAmount(entry.matured_profit),
        unmatured_profit: toAmount(entry.unmatured_profit),
      }))
      .sort((a, b) => toPaisa(b.funded) - toPaisa(a.funded));
  }

  private totals(rows: FundingReportRow[]): FundingReportTotals {
    const sum = (pick: (row: FundingReportRow) => string): number =>
      rows.reduce((total, row) => total + toPaisa(pick(row)), 0);

    const investors = new Set(
      rows.flatMap((row) => row.stakes.map((stake) => stake.investor_id)),
    );

    return {
      contracts: rows.length,
      sole: rows.filter((row) => row.arrangement === 'sole').length,
      joint: rows.filter((row) => row.arrangement === 'joint').length,
      investors: investors.size,
      funded: toAmount(sum((row) => row.funded)),
      capital_recovered: toAmount(sum((row) => row.capital_recovered)),
      capital_outstanding: toAmount(sum((row) => row.capital_outstanding)),
      matured_profit: toAmount(sum((row) => row.matured_profit)),
      unmatured_profit: toAmount(sum((row) => row.unmatured_profit)),
    };
  }
}
