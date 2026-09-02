import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  InvestorBucket,
  InvestorStatus,
  InvestorTxnType,
} from '../common/enums';
import { paginate, type Paginated } from '../common/pagination';
import { Investor, InvestorTransaction } from '../database/entities';
import {
  bucketBalances,
  lifetimeMetrics,
  NO_DEPLOYMENTS,
  toAmount,
  toPaisa,
  type DeploymentTerms,
  type InvestorTxn,
} from '../formulas';
import { FundingService } from '../contracts/funding.service';
import { SettingsService } from '../settings/settings.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { CreateInvestorDto } from './dto/create-investor.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListInvestorsDto } from './dto/list-investors.dto';
import { UpdateInvestorDto } from './dto/update-investor.dto';
import {
  toInvestorResponse,
  toTransactionResponse,
  type InvestorPosition,
  type InvestorResponse,
  type InvestorRow,
  type TransactionResponse,
} from './investor.mapper';

/** Module 13 (SRS amendment §J–§L). Investor capital; admin only. */
@Injectable()
export class InvestorsService {
  constructor(
    @InjectRepository(Investor)
    private readonly investors: Repository<Investor>,
    @InjectRepository(InvestorTransaction)
    private readonly transactions: Repository<InvestorTransaction>,
    private readonly settings: SettingsService,
    private readonly funding: FundingService,
    private readonly audit: AuditService,
  ) {}

  /** FR-IVT-01 */
  async findAll(query: ListInvestorsDto): Promise<Paginated<InvestorRow>> {
    const where = query.status ? { status: query.status } : {};

    const [rows, total] = await this.investors.findAndCount({
      where: query.search
        ? [
            { ...where, full_name: ILike(`%${query.search}%`) },
            { ...where, cnic_number: ILike(`%${query.search}%`) },
            { ...where, mobile_number: ILike(`%${query.search}%`) },
          ]
        : where,
      order: { full_name: 'ASC', id: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });

    // Two grouped reads for the whole page rather than a pair per row: the
    // hand-entered ledger, and what every contract they funded has returned.
    const ids = rows.map((row) => row.id);
    const ledgers = await this.ledgersFor(ids);
    const deployments = await this.funding.deploymentsFor(ids);

    return paginate(
      rows.map((row) => {
        const balances = bucketBalances(
          ledgers.get(row.id) ?? [],
          deployments.get(row.id) ?? NO_DEPLOYMENTS,
        );

        return {
          ...toInvestorResponse(row),
          net_principal: toAmount(balances.net_principal),
          lifetime_profit: toAmount(balances.lifetime_profit),
          available: toAmount(balances.available),
          deployed: toAmount(balances.deployed),
          payable: toAmount(balances.payable),
        };
      }),
      total,
      query.page,
      query.page_size,
    );
  }

  /**
   * FR-SUM-11. Every investor's position, added up.
   *
   * The other side of BR-25: the Summary Report nets investor participation
   * out of the house's figures, and this says what was netted out. Derived the
   * same way a single investor's strip is, so the report and the register
   * cannot disagree.
   *
   * Inactive investors are included. Their capital is still deployed and still
   * owed — FR-IVT-04 stops them taking on new deployments, not existing ones.
   */
  async portfolioPosition(): Promise<InvestorPosition> {
    const rows = await this.investors.find({ select: { id: true } });
    const ids = rows.map((row) => row.id);

    const totals: InvestorPosition = {
      investors: ids.length,
      deposited: '0.00',
      withdrawn: '0.00',
      net_principal: '0.00',
      principal_deployed: '0.00',
      profit_deployed: '0.00',
      deployed: '0.00',
      available: '0.00',
      lifetime_profit: '0.00',
      payable: '0.00',
    };

    if (ids.length === 0) return totals;

    const ledgers = await this.ledgersFor(ids);
    const deployments = await this.funding.deploymentsFor(ids);

    let deposited = 0;
    let withdrawn = 0;
    const sums = {
      net_principal: 0,
      principal_deployed: 0,
      profit_deployed: 0,
      deployed: 0,
      available: 0,
      lifetime_profit: 0,
      payable: 0,
    };

    for (const id of ids) {
      const ledger = ledgers.get(id) ?? [];

      for (const txn of ledger) {
        if (txn.type === 'Deposit') deposited += txn.amount;
        if (txn.type === 'Withdrawal') withdrawn += txn.amount;
      }

      const balances = bucketBalances(
        ledger,
        deployments.get(id) ?? NO_DEPLOYMENTS,
      );

      for (const key of Object.keys(sums) as (keyof typeof sums)[]) {
        sums[key] += balances[key];
      }
    }

    return {
      investors: ids.length,
      deposited: toAmount(deposited),
      withdrawn: toAmount(withdrawn),
      net_principal: toAmount(sums.net_principal),
      principal_deployed: toAmount(sums.principal_deployed),
      profit_deployed: toAmount(sums.profit_deployed),
      deployed: toAmount(sums.deployed),
      available: toAmount(sums.available),
      lifetime_profit: toAmount(sums.lifetime_profit),
      payable: toAmount(sums.payable),
    };
  }

  /** FR-IVT-09. The KPI strip: everything derived, nothing stored. */
  async findOne(id: number): Promise<
    InvestorResponse & {
      balances: ReturnType<typeof this.describeBalances>;
      transactions: TransactionResponse[];
    }
  > {
    const investor = await this.loadOrFail(id);

    const rows = await this.transactions.find({
      where: { investor_id: id },
      relations: { enteredBy: true },
      order: { txn_date: 'DESC', id: 'DESC' },
    });

    const deployments = await this.funding.deploymentsFor([id]);

    return {
      ...toInvestorResponse(investor),
      balances: this.describeBalances(
        rows.map(toLedgerLine),
        deployments.get(id),
      ),
      transactions: rows.map(toTransactionResponse),
    };
  }

  /**
   * FR-CON-11. Active investors with money to deploy, for the funding panel.
   *
   * Only those with an available balance: an investor who is fully deployed
   * has nothing to offer this deal, and listing them at zero would invite an
   * allocation the API would then refuse.
   */
  async fundable(): Promise<
    {
      id: number;
      full_name: string;
      available: string;
    }[]
  > {
    const rows = await this.investors.find({
      where: { status: InvestorStatus.active },
      order: { full_name: 'ASC' },
    });

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const ledgers = await this.ledgersFor(ids);
    const deployments = await this.funding.deploymentsFor(ids);

    return rows
      .map((row) => ({
        id: row.id,
        full_name: row.full_name,
        available: bucketBalances(
          ledgers.get(row.id) ?? [],
          deployments.get(row.id) ?? NO_DEPLOYMENTS,
        ).available,
      }))
      .filter((row) => row.available > 0)
      .map((row) => ({ ...row, available: toAmount(row.available) }));
  }

  /** FR-IVT-02 */
  async create(
    dto: CreateInvestorDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<InvestorResponse> {
    await this.assertCnicFree(dto.cnic_number);

    const saved = await this.investors.save(
      this.investors.create({
        full_name: dto.full_name,
        father_husband_name: dto.father_husband_name,
        cnic_number: dto.cnic_number,
        mobile_number: dto.mobile_number,
        address: dto.address,
        email: dto.email ?? null,
        loss_participation: dto.loss_participation ?? true,
        agreement_date: dto.agreement_date?.slice(0, 10) ?? null,
        status: dto.status ?? InvestorStatus.active,
        notes: dto.notes ?? null,
      }),
    );

    const response = toInvestorResponse(saved);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'investor',
      entity_id: String(saved.id),
      action: 'create',
      after: { ...response },
      ip,
    });

    return response;
  }

  /** FR-IVT-03 */
  async update(
    id: number,
    dto: UpdateInvestorDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<InvestorResponse> {
    const investor = await this.loadOrFail(id);
    const before = toInvestorResponse(investor);

    if (dto.cnic_number && dto.cnic_number !== investor.cnic_number) {
      await this.assertCnicFree(dto.cnic_number, id);
    }

    await this.investors.update(
      { id },
      {
        full_name: dto.full_name,
        father_husband_name: dto.father_husband_name,
        cnic_number: dto.cnic_number,
        mobile_number: dto.mobile_number,
        address: dto.address,
        email: dto.email,
        loss_participation: dto.loss_participation,
        agreement_date: dto.agreement_date?.slice(0, 10),
        status: dto.status,
        notes: dto.notes,
      },
    );

    const response = toInvestorResponse(await this.loadOrFail(id));

    await this.audit.record({
      actor_id: actor.id,
      entity: 'investor',
      entity_id: String(id),
      action: 'update',
      before: { ...before },
      after: { ...response },
      ip,
    });

    return response;
  }

  /**
   * FR-IVT-04. Soft delete is blocked while the investor still has money in
   * the business — idle or deployed. Removing them then would leave a balance
   * owed to nobody.
   */
  async remove(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const investor = await this.loadOrFail(id);

    const balances = bucketBalances(
      await this.ledgerFor(id),
      (await this.funding.deploymentsFor([id])).get(id) ?? NO_DEPLOYMENTS,
    );

    if (balances.payable !== 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `${investor.full_name} still has ${toAmount(balances.payable)} with the business. Settle it before removing them.`,
        payable: toAmount(balances.payable),
      });
    }

    await this.investors.softDelete({ id });

    await this.audit.record({
      actor_id: actor.id,
      entity: 'investor',
      entity_id: String(id),
      action: 'delete',
      before: { ...toInvestorResponse(investor) },
      ip,
    });
  }

  // ------------------------------------------------------- transactions --

  /** FR-IVT-05. Credits the principal bucket, always. */
  async deposit(
    id: number,
    dto: CreateTransactionDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<TransactionResponse> {
    await this.loadOrFail(id);

    return this.write(
      id,
      {
        type: InvestorTxnType.Deposit,
        bucket: InvestorBucket.principal,
        amount: toAmount(toPaisa(dto.amount)),
        txn_date: dto.txn_date.slice(0, 10),
        method: dto.method,
        reference: dto.reference ?? null,
      },
      actor,
      ip,
    );
  }

  /**
   * FR-IVT-06. Takes from the bucket asked for, or the one the setting
   * chooses. Refused with the exact overage when the bucket cannot cover it —
   * "insufficient funds" is not something a clerk can act on.
   */
  async withdraw(
    id: number,
    dto: CreateTransactionDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<TransactionResponse> {
    await this.loadOrFail(id);

    const balances = bucketBalances(
      await this.ledgerFor(id),
      (await this.funding.deploymentsFor([id])).get(id) ?? NO_DEPLOYMENTS,
    );
    const amount = toPaisa(dto.amount);

    const preference = await this.settings.get('withdrawal_source');

    // `pro_rata` has no meaning for a withdrawal, which lands on one bucket;
    // it falls back to taking profit first.
    const bucket =
      dto.bucket ??
      (preference === 'principal_first'
        ? InvestorBucket.principal
        : InvestorBucket.profit);

    const availableIn =
      bucket === InvestorBucket.principal
        ? balances.principal_available
        : balances.profit_available;

    if (amount > availableIn) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `That is ${toAmount(amount - availableIn)} more than the ${toAmount(availableIn)} available in the ${bucket} bucket.`,
        field_errors: { amount: `At most ${toAmount(availableIn)}` },
        available: toAmount(availableIn),
        overage: toAmount(amount - availableIn),
      });
    }

    return this.write(
      id,
      {
        type: InvestorTxnType.Withdrawal,
        bucket,
        amount: toAmount(amount),
        txn_date: dto.txn_date.slice(0, 10),
        method: dto.method,
        reference: dto.reference ?? null,
      },
      actor,
      ip,
    );
  }

  /** FR-IVT-08. Signed, reasoned, and the only correction there is. */
  async adjust(
    id: number,
    dto: CreateAdjustmentDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<TransactionResponse> {
    await this.loadOrFail(id);

    if (dto.amount === 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'An adjustment of zero changes nothing',
        field_errors: { amount: 'Must be positive or negative, not zero' },
      });
    }

    return this.write(
      id,
      {
        type: InvestorTxnType.Adjustment,
        bucket: dto.bucket,
        // The sign is the correction's direction and is kept on the row.
        amount: toAmount(toPaisa(dto.amount)),
        txn_date: dto.txn_date.slice(0, 10),
        method: null,
        reference: null,
        reason: dto.reason,
      },
      actor,
      ip,
    );
  }

  // ---------------------------------------------------------- internals --

  private describeBalances(
    lines: InvestorTxn[],
    deployment?: DeploymentTerms & { total_deployed?: number },
  ) {
    const balances = bucketBalances(lines, deployment ?? NO_DEPLOYMENTS);

    // BR-24's turnover counts every rupee ever put to work, not what is out
    // right now — money that went out and came back still did its job.
    const metrics = lifetimeMetrics(
      balances,
      deployment?.total_deployed ?? balances.deployed,
    );

    return {
      net_principal: toAmount(balances.net_principal),
      principal_available: toAmount(balances.principal_available),
      principal_deployed: toAmount(balances.principal_deployed),
      lifetime_profit: toAmount(balances.lifetime_profit),
      profit_available: toAmount(balances.profit_available),
      profit_deployed: toAmount(balances.profit_deployed),
      available: toAmount(balances.available),
      deployed: toAmount(balances.deployed),
      payable: toAmount(balances.payable),
      ...metrics,
    };
  }

  private async write(
    investorId: number,
    row: Partial<InvestorTransaction>,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<TransactionResponse> {
    const saved = await this.transactions.save(
      this.transactions.create({
        ...row,
        investor_id: investorId,
        entered_by: actor.id,
      }),
    );

    const full = await this.transactions.findOne({
      where: { id: saved.id },
      relations: { enteredBy: true },
    });

    const response = toTransactionResponse(full ?? saved);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'investor_transaction',
      entity_id: String(saved.id),
      action: String(row.type ?? 'create').toLowerCase(),
      after: { ...response, investor_id: investorId },
      ip,
    });

    return response;
  }

  private async ledgerFor(investorId: number): Promise<InvestorTxn[]> {
    const rows = await this.transactions.find({
      where: { investor_id: investorId },
      select: { type: true, bucket: true, amount: true, reason: true },
    });

    return rows.map(toLedgerLine);
  }

  private async ledgersFor(ids: number[]): Promise<Map<number, InvestorTxn[]>> {
    if (ids.length === 0) return new Map();

    const rows = await this.transactions.find({
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

    for (const row of rows) {
      grouped.set(row.investor_id, [
        ...(grouped.get(row.investor_id) ?? []),
        toLedgerLine(row),
      ]);
    }

    return grouped;
  }

  private async assertCnicFree(cnic: string, exceptId?: number): Promise<void> {
    const taken = await this.investors.findOne({
      where: { cnic_number: cnic },
    });

    if (!taken || taken.id === exceptId) return;

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: `CNIC "${cnic}" already belongs to ${taken.full_name}`,
      field_errors: { cnic_number: 'This CNIC is already registered' },
    });
  }

  private async loadOrFail(id: number): Promise<Investor> {
    const investor = await this.investors.findOne({ where: { id } });

    if (!investor) throw new NotFoundException(`Investor ${id} not found`);

    return investor;
  }
}

/**
 * The database row as the formula package wants it: money in paisa. The enum
 * members carry the same strings the formula's unions expect, so no cast is
 * needed — an Adjustment keeps its sign, which is what makes it a correction.
 */
function toLedgerLine(row: {
  type: InvestorTxnType;
  bucket: InvestorBucket;
  amount: string;
  reason?: string | null;
}): InvestorTxn {
  return {
    type: row.type,
    bucket: row.bucket,
    amount: toPaisa(row.amount),
    reason: row.reason ?? null,
  };
}
