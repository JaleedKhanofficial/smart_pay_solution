import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InvestorStatus } from '../common/enums';
import {
  ContractFunding,
  Investor,
  InvestorTransaction,
  Payment,
} from '../database/entities';
import {
  bucketBalances,
  fundingShare,
  splitDeployment,
  splitRecovery,
  toAmount,
  toPaisa,
  type FundingRow,
  type InvestorTxn,
} from '../formulas';
import { SettingsService } from '../settings/settings.service';
import type { FundingLineDto } from './dto/funding-line.dto';

/** FR-CON-11. One funding line as the contract screen shows it. */
export type FundingResponse = {
  id: number;
  investor_id: number;
  investor_name: string;
  amount: string;
  share_pct: string;
  profit_share_pct: string;
  funded_from_principal: string;
  funded_from_profit: string;
  /** BR-23. True where recovered capital or matured profit paid for this. */
  reinvested: boolean;
  share_override_reason: string | null;
  funded_at: string;
};

/**
 * Module 13's other half: the link between an investor's money and a contract.
 *
 * Kept out of `ContractsService`, which is already large, and out of
 * `InvestorsService`, which owns the ledger. Funding belongs to neither — it
 * is the join, and it is the only place that reads both.
 */
@Injectable()
export class FundingService {
  constructor(
    @InjectRepository(ContractFunding)
    private readonly fundings: Repository<ContractFunding>,
    @InjectRepository(Investor)
    private readonly investors: Repository<Investor>,
    @InjectRepository(InvestorTransaction)
    private readonly transactions: Repository<InvestorTransaction>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    private readonly settings: SettingsService,
  ) {}

  /**
   * FR-CON-13. Everything that would make a funding set invalid, checked
   * before the contract is written — so a bad allocation never leaves a
   * half-activated deal behind.
   *
   * Returns the rows to write, bucket split included, so the caller does the
   * arithmetic once.
   */
  async prepare(
    lines: FundingLineDto[],
    costPrice: string | number,
  ): Promise<
    Omit<ContractFunding, 'id' | 'contract' | 'investor' | 'createdBy'>[]
  > {
    if (lines.length === 0) return [];

    const seen = new Set<number>();

    for (const line of lines) {
      if (seen.has(line.investor_id)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: `Investor ${line.investor_id} appears twice. Combine the two lines into one.`,
        });
      }

      seen.add(line.investor_id);

      if (line.profit_share_pct !== undefined && !line.share_override_reason) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message:
            'Overriding an investor’s profit share needs a reason (FR-CON-12).',
          field_errors: {
            share_override_reason: 'Say why this deal differs',
          },
        });
      }
    }

    const cost = toPaisa(costPrice);
    const total = lines.reduce((sum, line) => sum + toPaisa(line.amount), 0);

    if (total > cost) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Funding of ${toAmount(total)} exceeds the ${toAmount(cost)} this contract costs. The house cannot be funded below zero.`,
        cost_price: toAmount(cost),
        funded: toAmount(total),
      });
    }

    const investors = await this.investors.find({
      where: { id: In([...seen]) },
    });

    const byId = new Map(investors.map((investor) => [investor.id, investor]));
    const balances = await this.balancesFor([...seen]);
    const source = await this.settings.get('deployment_source');

    return lines.map((line) => {
      const investor = byId.get(line.investor_id);

      if (!investor) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: `Investor "${line.investor_id}" does not exist`,
        });
      }

      // FR-IVT-04: an inactive investor keeps recovering what they already
      // funded, but takes on nothing new.
      if (investor.status !== InvestorStatus.active) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `${investor.full_name} is inactive and cannot take a new deployment.`,
        });
      }

      const amount = toPaisa(line.amount);
      const position = balances.get(line.investor_id);
      const available = position?.available ?? 0;

      if (amount > available) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `${investor.full_name} has ${toAmount(available)} available, which is ${toAmount(amount - available)} short of the ${toAmount(amount)} allocated.`,
          available: toAmount(available),
          shortfall: toAmount(amount - available),
        });
      }

      // BR-22. Which bucket the money comes out of, and BR-23: nothing marks
      // this as a reinvestment — it simply is one when profit is drawn on.
      const split = splitDeployment(
        amount,
        position?.principal_available ?? 0,
        position?.profit_available ?? 0,
        source,
      );

      return {
        contract_id: 0, // set by the caller inside the transaction
        investor_id: line.investor_id,
        amount: toAmount(amount),
        share_pct: fundingShare(amount, costPrice),
        // BR-16. Seeded from the investor and frozen here.
        profit_share_pct: (
          line.profit_share_pct ?? Number(investor.profit_share_pct)
        ).toFixed(2),
        funded_from_principal: toAmount(split.from_principal),
        funded_from_profit: toAmount(split.from_profit),
        share_override_reason: line.share_override_reason ?? null,
        funded_at: new Date(),
        created_by: 0, // set by the caller
      } as Omit<ContractFunding, 'id' | 'contract' | 'investor' | 'createdBy'>;
    });
  }

  /** Writes the prepared rows inside the caller's transaction. */
  async attach(
    manager: EntityManager,
    contractId: number,
    rows: Omit<ContractFunding, 'id' | 'contract' | 'investor' | 'createdBy'>[],
    actor: AuthenticatedUser,
  ): Promise<void> {
    for (const row of rows) {
      await manager.save(
        manager.create(ContractFunding, {
          ...row,
          contract_id: contractId,
          created_by: actor.id,
        }),
      );
    }
  }

  /** FR-CON-11. The funding panel's current state for one contract. */
  async forContract(contractId: number): Promise<FundingResponse[]> {
    const rows = await this.fundings.find({
      where: { contract_id: contractId },
      relations: { investor: true },
      order: { amount: 'DESC', id: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      investor_id: row.investor_id,
      investor_name: row.investor?.full_name ?? '',
      amount: row.amount,
      share_pct: row.share_pct,
      profit_share_pct: row.profit_share_pct,
      funded_from_principal: row.funded_from_principal,
      funded_from_profit: row.funded_from_profit,
      reinvested: toPaisa(row.funded_from_profit) > 0,
      share_override_reason: row.share_override_reason,
      funded_at: row.funded_at.toISOString(),
    }));
  }

  /**
   * BR-21's deployment terms for a set of investors, read from every contract
   * they have funded and everything those contracts have recovered.
   *
   * This is what turns `deployed` and `lifetime_profit` from structural zeros
   * into real figures.
   */
  async deploymentsFor(investorIds: number[]) {
    const empty = new Map<
      number,
      {
        funded_from_principal: number;
        funded_from_profit: number;
        recovered_to_principal: number;
        recovered_to_profit: number;
        matured_profit: number;
        total_deployed: number;
      }
    >();

    if (investorIds.length === 0) return empty;

    const rows = await this.fundings.find({
      where: { investor_id: In(investorIds) },
      relations: { contract: true },
    });

    if (rows.length === 0) return empty;

    // Every contract these investors touched, and what it has collected.
    const contractIds = [...new Set(rows.map((row) => row.contract_id))];

    const payments = await this.payments.find({
      where: { contract_id: In(contractIds), deleted_at: IsNull() },
      select: { contract_id: true, amount: true },
    });

    const paidBy = new Map<number, number>();

    for (const payment of payments) {
      paidBy.set(
        payment.contract_id,
        (paidBy.get(payment.contract_id) ?? 0) + toPaisa(payment.amount),
      );
    }

    // A contract's recovery has to be split across *all* its funders, not just
    // the ones asked about, or every share would be overstated.
    const allForContracts = await this.fundings.find({
      where: { contract_id: In(contractIds) },
    });

    const fundingsBy = new Map<number, ContractFunding[]>();

    for (const row of allForContracts) {
      fundingsBy.set(row.contract_id, [
        ...(fundingsBy.get(row.contract_id) ?? []),
        row,
      ]);
    }

    for (const row of rows) {
      const contract = row.contract;

      if (!contract) continue;

      const recovery = splitRecovery(
        {
          down_payment: contract.down_payment,
          paid: paidBy.get(row.contract_id) ?? 0,
          markup_amount: contract.markup_amount,
        },
        (fundingsBy.get(row.contract_id) ?? []).map(toFundingRow),
      );

      const mine = recovery.shares.find(
        (share) => share.investor_id === row.investor_id,
      );

      const current = empty.get(row.investor_id) ?? {
        funded_from_principal: 0,
        funded_from_profit: 0,
        recovered_to_principal: 0,
        recovered_to_profit: 0,
        matured_profit: 0,
        total_deployed: 0,
      };

      current.funded_from_principal += toPaisa(row.funded_from_principal);
      current.funded_from_profit += toPaisa(row.funded_from_profit);
      current.recovered_to_principal += mine?.recovered_to_principal ?? 0;
      current.recovered_to_profit += mine?.recovered_to_profit ?? 0;
      current.matured_profit += mine?.matured_profit ?? 0;
      current.total_deployed += toPaisa(row.amount);

      empty.set(row.investor_id, current);
    }

    return empty;
  }

  // --------------------------------------------------------- internals --

  private async balancesFor(ids: number[]) {
    const txns = await this.transactions.find({
      where: { investor_id: In(ids) },
      select: { investor_id: true, type: true, bucket: true, amount: true },
    });

    const grouped = new Map<number, InvestorTxn[]>();

    for (const txn of txns) {
      grouped.set(txn.investor_id, [
        ...(grouped.get(txn.investor_id) ?? []),
        {
          type: txn.type,
          bucket: txn.bucket,
          amount: toPaisa(txn.amount),
        },
      ]);
    }

    const deployments = await this.deploymentsFor(ids);
    const balances = new Map<number, ReturnType<typeof bucketBalances>>();

    for (const id of ids) {
      balances.set(
        id,
        bucketBalances(grouped.get(id) ?? [], {
          ...(deployments.get(id) ?? {
            funded_from_principal: 0,
            funded_from_profit: 0,
            recovered_to_principal: 0,
            recovered_to_profit: 0,
            matured_profit: 0,
          }),
        }),
      );
    }

    return balances;
  }
}

/** The stored row as the formula package wants it. */
export function toFundingRow(row: ContractFunding): FundingRow {
  return {
    investor_id: row.investor_id,
    amount: toPaisa(row.amount),
    share_pct: row.share_pct,
    profit_share_pct: row.profit_share_pct,
    funded_from_principal: toPaisa(row.funded_from_principal),
    funded_from_profit: toPaisa(row.funded_from_profit),
  };
}
