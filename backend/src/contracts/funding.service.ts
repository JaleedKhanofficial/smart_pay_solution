import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ContractStatus,
  InvestorBucket,
  InvestorStatus,
  InvestorTxnType,
} from '../common/enums';
import {
  Contract,
  ContractFunding,
  ContractRecycleSnapshot,
  Investor,
  InvestorTransaction,
  Payment,
} from '../database/entities';
import type { ContractRecycleSnapshotData } from '../database/entities/contract-recycle-snapshot.entity';
import {
  bucketBalances,
  allocateLoss,
  fundingShare,
  houseFunded,
  splitDeployment,
  splitRecovery,
  toAmount,
  toPaisa,
  PURGE_PROFIT_MATERIALIZED_PREFIX,
  type FundingRow,
  type InvestorTxn,
  type LossAllocation,
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
  funded_from_principal: string;
  funded_from_profit: string;
  /** BR-23. True where recovered capital or matured profit paid for this. */
  reinvested: boolean;
  funded_at: string;
};

/** FR-BIN-03. What each funder gets back when a contract is purged. */
export type PurgeReturnPreview = {
  investor_id: number;
  investor_name: string;
  funded: string;
  recovered: string;
  /** Capital that will return to idle when the deal is destroyed. */
  returning: string;
  /** Profit locked in before the funding rows are removed. */
  matured_profit: string;
};

/** BR-20 / FR-CON-16. What a write-off would cost, per investor. */
export type LossPreview = {
  investor_id: number;
  investor_name: string;
  /** Their whole stake in this contract. */
  funded: string;
  /** What came back before the stream stopped. */
  recovered: string;
  unrecovered: string;
  from_principal: string;
  from_profit: string;
  extinguished_profit: string;
  /** False: the house absorbs it and this investor loses nothing. */
  participates: boolean;
};

/** FR-BIN-02. What the restore dialog needs for a funded contract. */
export type ContractRestorePreview = {
  contract_id: number;
  captured_at: string | null;
  fundings: ContractRecycleSnapshotData['fundings'];
  investors: Array<{ id: number; full_name: string; available: string }>;
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
        funded_from_principal: toAmount(split.from_principal),
        funded_from_profit: toAmount(split.from_profit),
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
      funded_from_principal: row.funded_from_principal,
      funded_from_profit: row.funded_from_profit,
      reinvested: toPaisa(row.funded_from_profit) > 0,
      funded_at: row.funded_at.toISOString(),
    }));
  }

  /**
   * BR-20. What writing this contract off would cost each funder.
   *
   * Read-only, so a confirmation can name the investors and the amounts before
   * anyone commits to it (FR-CON-16). Empty for a contract nobody funded,
   * which is the common case.
   */
  previewLoss(
    contractId: number,
    includeVoidedPayments = false,
  ): Promise<LossPreview[]> {
    return previewContractLoss(
      this.fundings.manager,
      contractId,
      includeVoidedPayments,
    );
  }

  /** FR-BIN-03. Capital returning to each funder on a Recycle Bin purge. */
  previewPurgeReturn(contractId: number): Promise<PurgeReturnPreview[]> {
    return previewContractPurge(this.fundings.manager, contractId);
  }

  /** FR-BIN-02. Funded contracts need an investor picker before they return. */
  async contractRestorePreview(
    contractId: number,
  ): Promise<ContractRestorePreview | null> {
    const manager = this.fundings.manager;

    const contract = await manager.findOne(Contract, {
      where: { id: contractId },
      withDeleted: true,
    });

    if (!contract?.deleted_at) return null;

    const stored = await manager.findOne(ContractRecycleSnapshot, {
      where: { contract_id: contractId },
    });

    let lines = stored?.snapshot.fundings ?? [];

    if (lines.length === 0) {
      const rows = await manager.find(ContractFunding, {
        where: { contract_id: contractId },
        relations: { investor: true },
        order: { id: 'ASC' },
      });

      lines = rows.map((row) => ({
        investor_id: row.investor_id,
        investor_name: row.investor?.full_name ?? '',
        amount: row.amount,
        share_pct: row.share_pct,
        funded_from_principal: row.funded_from_principal,
        funded_from_profit: row.funded_from_profit,
      }));
    }

    if (lines.length === 0) return null;

    const investors = await this.listInvestorsForRestore();

    return {
      contract_id: contractId,
      captured_at: stored?.snapshot.captured_at ?? null,
      fundings: lines,
      investors,
    };
  }

  /** FR-CON-09. Freeze investor stakes the moment a contract enters the bin. */
  async captureRecycleSnapshot(
    manager: EntityManager,
    contractId: number,
  ): Promise<void> {
    const fundings = await manager.find(ContractFunding, {
      where: { contract_id: contractId },
      relations: { investor: true },
      order: { id: 'ASC' },
    });

    if (fundings.length === 0) {
      await manager.delete(ContractRecycleSnapshot, { contract_id: contractId });

      return;
    }

    const contract = await manager.findOne(Contract, {
      where: { id: contractId },
    });

    if (!contract) return;

    const payments = await manager.find(Payment, {
      where: { contract_id: contractId },
      withDeleted: true,
      select: { amount: true },
    });

    const snapshot: ContractRecycleSnapshotData = {
      captured_at: new Date().toISOString(),
      fundings: fundings.map((row) => ({
        investor_id: row.investor_id,
        investor_name: row.investor?.full_name ?? '',
        amount: row.amount,
        share_pct: row.share_pct,
        funded_from_principal: row.funded_from_principal,
        funded_from_profit: row.funded_from_profit,
      })),
      recovery: {
        down_payment: contract.down_payment,
        paid: toAmount(
          payments.reduce((total, row) => total + toPaisa(row.amount), 0),
        ),
        markup_amount: contract.markup_amount,
      },
    };

    await manager.save(
      manager.create(ContractRecycleSnapshot, {
        contract_id: contractId,
        snapshot,
        captured_at: new Date(),
      }),
    );
  }

  /**
   * FR-BIN-02. Reassign funders when a deleted contract is restored — the
   * admin chooses who carries each stake going forward.
   */
  async reassignFundingsOnRestore(
    manager: EntityManager,
    contractId: number,
    assignments: Array<{ investor_id: number }>,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const fundings = await manager.find(ContractFunding, {
      where: { contract_id: contractId },
      order: { id: 'ASC' },
    });

    if (fundings.length === 0) return;

    if (assignments.length !== fundings.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          'Choose an investor for every funding line before restoring this contract.',
      });
    }

    const balances = await this.balancesForManager(manager, [
      ...new Set(assignments.map((line) => line.investor_id)),
    ]);

    for (let index = 0; index < fundings.length; index++) {
      const row = fundings[index];
      const targetId = assignments[index].investor_id;

      if (targetId === row.investor_id) continue;

      const investor = await manager.findOne(Investor, {
        where: { id: targetId },
      });

      if (!investor || investor.status !== InvestorStatus.active) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `Investor ${targetId} is not available to take this stake.`,
        });
      }

      const available = balances.get(targetId)?.available ?? 0;
      const amount = toPaisa(row.amount);

      if (amount > available) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `${investor.full_name} has only ${toAmount(available)} available — ${toAmount(amount - available)} short for this stake.`,
        });
      }

      await manager.update(
        ContractFunding,
        { id: row.id },
        { investor_id: targetId, created_by: actor.id },
      );
    }
  }

  /** BR-20, inside the caller's transaction. See `settleContractLosses`. */
  settleLosses(
    manager: EntityManager,
    contractId: number,
    actor: AuthenticatedUser,
    reason: string,
  ): Promise<LossAllocation | null> {
    return settleContractLosses(manager, contractId, actor, reason);
  }

  /**
   * BR-14. What the house itself put in: the cost, less every investor stake.
   *
   * Read from the stored rows rather than remembered, because the funding is
   * the authority — the contract carries no column for it, precisely so the
   * two cannot drift apart.
   */
  async houseFundedFor(
    contractId: number,
    costPrice: string | number,
  ): Promise<string> {
    const rows = await this.fundings.find({
      where: { contract_id: contractId },
      select: { investor_id: true, amount: true },
    });

    // Only the amount matters to BR-14, so the row is narrowed to it rather
    // than selecting six columns to satisfy a shape nothing here reads.
    return toAmount(
      houseFunded(
        costPrice,
        rows.map((row) => ({ amount: toPaisa(row.amount) }) as FundingRow),
      ),
    );
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
    });

    if (rows.length === 0) return empty;

    // Every contract these investors touched, and what it has collected.
    const contractIds = [...new Set(rows.map((row) => row.contract_id))];

    // `withDeleted` on purpose: a contract sitting in the Recycle Bin has not
    // been settled, so the capital in it is still out. Dropping it here would
    // quietly return that money to the investor's idle balance and let them
    // deploy it twice.
    const contracts = await this.fundings.manager.find(Contract, {
      where: { id: In(contractIds) },
      withDeleted: true,
    });

    const byContract = new Map(
      contracts.map((contract) => [contract.id, contract]),
    );

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
      const contract = byContract.get(row.contract_id);

      if (!contract) continue;

      /**
       * BR-20. A written-off contract is settled: whatever did not come back
       * is a Loss on the ledger, so the deployment is over and the capital
       * stops counting as out. Matured profit survives — it was earned before
       * the stream stopped, and extinguishing it would take back money the
       * investor is genuinely owed.
       */
      const settled =
        contract.status === ContractStatus.cancelled && contract.write_off;

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

      if (!settled) {
        current.funded_from_principal += toPaisa(row.funded_from_principal);
        current.funded_from_profit += toPaisa(row.funded_from_profit);
        current.recovered_to_principal += mine?.recovered_to_principal ?? 0;
        current.recovered_to_profit += mine?.recovered_to_profit ?? 0;
        current.total_deployed += toPaisa(row.amount);
      }

      current.matured_profit += mine?.matured_profit ?? 0;

      empty.set(row.investor_id, current);
    }

    return empty;
  }

  // --------------------------------------------------------- internals --

  /** Active investors for the restore picker — includes fully deployed ones. */
  private async listInvestorsForRestore(): Promise<
    ContractRestorePreview['investors']
  > {
    const rows = await this.investors.find({
      where: { status: InvestorStatus.active },
      order: { full_name: 'ASC' },
    });

    if (rows.length === 0) return [];

    const balances = await this.balancesFor(rows.map((row) => row.id));

    return rows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      available: toAmount(balances.get(row.id)?.available ?? 0),
    }));
  }

  private async balancesFor(ids: number[]) {
    const txns = await this.transactions.find({
      where: { investor_id: In(ids) },
      select: {
        investor_id: true,
        type: true,
        bucket: true,
        amount: true,
        reason: true,
      },
    });

    const grouped = new Map<number, InvestorTxn[]>();

    for (const txn of txns) {
      grouped.set(txn.investor_id, [
        ...(grouped.get(txn.investor_id) ?? []),
        {
          type: txn.type,
          bucket: txn.bucket,
          amount: toPaisa(txn.amount),
          reason: txn.reason,
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

  private async balancesForManager(manager: EntityManager, ids: number[]) {
    if (ids.length === 0) return new Map();

    const txns = await manager.find(InvestorTransaction, {
      where: { investor_id: In(ids) },
      select: {
        investor_id: true,
        type: true,
        bucket: true,
        amount: true,
        reason: true,
      },
    });

    const grouped = new Map<number, InvestorTxn[]>();

    for (const txn of txns) {
      grouped.set(txn.investor_id, [
        ...(grouped.get(txn.investor_id) ?? []),
        {
          type: txn.type,
          bucket: txn.bucket,
          amount: toPaisa(txn.amount),
          reason: txn.reason,
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
    funded_from_principal: toPaisa(row.funded_from_principal),
    funded_from_profit: toPaisa(row.funded_from_profit),
  };
}

/**
 * Everything BR-20 needs about one contract, read once so the preview and the
 * write cannot disagree about what is owed.
 *
 * A free function rather than a method because the Recycle Bin's registry is a
 * plain object with no injector — the purge path and the cancel path have to
 * reach the same code, and this is the only shape both can use.
 */
async function prepareLoss(
  manager: EntityManager,
  contractId: number,
  options?: { includeVoidedPayments?: boolean },
) {
  const fundings = await manager.find(ContractFunding, {
    where: { contract_id: contractId },
    order: { id: 'ASC' },
  });

  if (fundings.length === 0) return null;

  const contract = await manager.findOne(Contract, {
    where: { id: contractId },
    withDeleted: true,
  });

  if (!contract) return null;

  /**
   * BR-20 happens once. A contract cancelled with `write_off` has already had
   * its losses allocated, and reaching here again — by purging it out of the
   * Recycle Bin afterwards — would write a second set of Loss rows and charge
   * every funder twice for the same failure.
   *
   * The settled flag is the same one `deploymentsFor` reads to stop counting
   * the capital as deployed, so the two cannot disagree about whether a
   * contract is finished with.
   */
  if (contract.status === ContractStatus.cancelled && contract.write_off) {
    return null;
  }

  const payments = await manager.find(Payment, {
    where: options?.includeVoidedPayments
      ? { contract_id: contractId }
      : { contract_id: contractId, deleted_at: IsNull() },
    ...(options?.includeVoidedPayments ? { withDeleted: true } : {}),
    select: { id: true, amount: true },
  });

  const investors = await manager.find(Investor, {
    where: { id: In(fundings.map((row) => row.investor_id)) },
    withDeleted: true,
  });

  const allocation = allocateLoss(
    {
      down_payment: contract.down_payment,
      paid: payments.reduce((total, row) => total + toPaisa(row.amount), 0),
      markup_amount: contract.markup_amount,
    },
    fundings.map(toFundingRow),
    new Map(
      investors.map((investor) => [investor.id, investor.loss_participation]),
    ),
  );

  return {
    allocation,
    fundings,
    names: new Map(
      investors.map((investor) => [investor.id, investor.full_name]),
    ),
  };
}

/** BR-20 / FR-CON-16. What a write-off would cost, per investor. */
export async function previewContractLoss(
  manager: EntityManager,
  contractId: number,
  includeVoidedPayments = false,
): Promise<LossPreview[]> {
  const prepared = await prepareLoss(manager, contractId, {
    includeVoidedPayments,
  });

  if (!prepared) return [];

  const { allocation, fundings, names } = prepared;

  return allocation.lines.map((line, index) => ({
    investor_id: line.investor_id,
    investor_name: names.get(line.investor_id) ?? '',
    funded: fundings[index].amount,
    recovered: toAmount(toPaisa(fundings[index].amount) - line.unrecovered),
    unrecovered: toAmount(line.unrecovered),
    from_principal: toAmount(line.from_principal),
    from_profit: toAmount(line.from_profit),
    extinguished_profit: toAmount(line.extinguished_profit),
    participates: line.participates,
  }));
}

/**
 * BR-20. Writes the loss off, inside the caller's transaction.
 *
 * Reached two ways — a cancellation that writes off an outstanding balance,
 * and a purge — because both destroy the stream the capital was coming back
 * through. Nothing is written for a funder whose stake fully returned.
 *
 * **A non-participating investor gets two rows, not none.** BR-20 says the
 * house absorbs their loss and an Adjustment credits them. Written on its own
 * that Adjustment would *add* to their balance, because the deployment it
 * compensates for stops counting the moment the contract is settled. The pair
 * — the Loss that happened, and the credit that made them whole — nets to zero
 * and says on the ledger what actually took place.
 */
export async function settleContractLosses(
  manager: EntityManager,
  contractId: number,
  actor: AuthenticatedUser,
  reason: string,
  /**
   * False when the contract is about to be destroyed. `contract_id` is a
   * RESTRICT foreign key, so a Loss row pointing at a purged contract would
   * block the very delete it was written for — and a link to a row that no
   * longer exists tells a reader nothing anyway. The reason names the contract
   * instead, which is what survives.
   */
  linkContract = true,
  options?: { includeVoidedPayments?: boolean },
): Promise<LossAllocation | null> {
  const prepared = await prepareLoss(manager, contractId, options);

  if (!prepared) return null;

  const { allocation } = prepared;
  const txn_date = new Date().toISOString().slice(0, 10);

  for (const line of allocation.lines) {
    if (line.unrecovered === 0) continue;

    // A charge spanning both buckets is written as two rows (SRS §5.17).
    const charges: [InvestorBucket, number][] = [
      [InvestorBucket.principal, line.from_principal],
      [InvestorBucket.profit, line.from_profit],
    ];

    for (const [bucket, amount] of charges) {
      if (amount === 0) continue;

      await manager.save(
        manager.create(InvestorTransaction, {
          investor_id: line.investor_id,
          type: InvestorTxnType.Loss,
          bucket,
          amount: toAmount(amount),
          txn_date,
          method: null,
          reference: null,
          contract_id: linkContract ? contractId : null,
          reason,
          entered_by: actor.id,
        }),
      );
    }

    if (line.participates) continue;

    await manager.save(
      manager.create(InvestorTransaction, {
        investor_id: line.investor_id,
        type: InvestorTxnType.Adjustment,
        // Credited back to whichever bucket carried the larger charge.
        bucket:
          line.from_principal >= line.from_profit
            ? InvestorBucket.principal
            : InvestorBucket.profit,
        amount: toAmount(line.unrecovered),
        txn_date,
        method: null,
        reference: null,
        contract_id: linkContract ? contractId : null,
        reason: `The business absorbed this loss: this investor does not participate in losses. ${reason}`,
        entered_by: actor.id,
      }),
    );
  }

  return allocation;
}

/**
 * Recycle Bin purge for a funded contract. Voided payments still count as
 * recovery when deciding matured profit. Capital that has not come back is
 * released to idle when the funding rows are deleted — it is not written off
 * as a Loss (that path is for cancellation with write-off, BR-20).
 */
export async function settleContractPurge(
  manager: EntityManager,
  contractId: number,
  actor: AuthenticatedUser,
  reason: string,
): Promise<void> {
  const fundings = await manager.find(ContractFunding, {
    where: { contract_id: contractId },
    order: { id: 'ASC' },
  });

  if (fundings.length === 0) return;

  const contract = await manager.findOne(Contract, {
    where: { id: contractId },
    withDeleted: true,
  });

  if (!contract) return;

  if (contract.status === ContractStatus.cancelled && contract.write_off) {
    return;
  }

  const payments = await manager.find(Payment, {
    where: { contract_id: contractId },
    withDeleted: true,
    select: { amount: true },
  });

  const paid = payments.reduce((total, row) => total + toPaisa(row.amount), 0);

  const recovery = splitRecovery(
    {
      down_payment: contract.down_payment,
      paid,
      markup_amount: contract.markup_amount,
    },
    fundings.map(toFundingRow),
  );

  const txn_date = new Date().toISOString().slice(0, 10);

  for (const share of recovery.shares) {
    if (share.matured_profit <= 0) continue;

    await manager.save(
      manager.create(InvestorTransaction, {
        investor_id: share.investor_id,
        type: InvestorTxnType.Adjustment,
        bucket: InvestorBucket.profit,
        amount: toAmount(share.matured_profit),
        txn_date,
        method: null,
        reference: null,
        contract_id: null,
        reason: `${PURGE_PROFIT_MATERIALIZED_PREFIX} ${reason}`,
        entered_by: actor.id,
      }),
    );
  }
}

/** FR-BIN-03. What each funder gets back when a contract is purged. */
export async function previewContractPurge(
  manager: EntityManager,
  contractId: number,
): Promise<PurgeReturnPreview[]> {
  const fundings = await manager.find(ContractFunding, {
    where: { contract_id: contractId },
    relations: { investor: true },
    order: { id: 'ASC' },
  });

  if (fundings.length === 0) return [];

  const contract = await manager.findOne(Contract, {
    where: { id: contractId },
    withDeleted: true,
  });

  if (!contract) return [];

  if (contract.status === ContractStatus.cancelled && contract.write_off) {
    return [];
  }

  const payments = await manager.find(Payment, {
    where: { contract_id: contractId },
    withDeleted: true,
    select: { amount: true },
  });

  const paid = payments.reduce((total, row) => total + toPaisa(row.amount), 0);

  const recovery = splitRecovery(
    {
      down_payment: contract.down_payment,
      paid,
      markup_amount: contract.markup_amount,
    },
    fundings.map(toFundingRow),
  );

  return fundings
    .map((row, index) => {
      const share = recovery.shares[index];
      const returning = Math.max(
        0,
        toPaisa(row.amount) - share.capital_recovered,
      );

      return {
        investor_id: row.investor_id,
        investor_name: row.investor?.full_name ?? '',
        funded: row.amount,
        recovered: toAmount(toPaisa(row.amount) - returning),
        returning: toAmount(returning),
        matured_profit: toAmount(share.matured_profit),
      };
    })
    .filter(
      (line) =>
        toPaisa(line.returning) > 0 || toPaisa(line.matured_profit) > 0,
    );
}
