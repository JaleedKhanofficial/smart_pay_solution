import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  And,
  DataSource,
  EntityManager,
  IsNull,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FundingService } from '../contracts/funding.service';
import { ListBinDto } from './dto/list-bin.dto';
import type { RestoreBinDto } from './dto/restore-bin.dto';
import {
  BIN_DEFINITIONS,
  BIN_KINDS,
  refuse,
  type BinKind,
  type BinRecord,
  type BinRow,
} from './recycle-bin.registry';

/** FR-BIN-01. What is in the bin, per kind, for the tab counts. */
export type BinSummary = { kind: BinKind; label: string; count: number }[];

/** Module 10 (SRS §4.10). Restore or purge soft-deleted records; admin only. */
@Injectable()
export class RecycleBinService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly funding: FundingService,
  ) {}

  /**
   * FR-BIN-01. Every deleted record of the requested kinds, newest first, each
   * already carrying whether it can be restored or purged.
   *
   * The blockers are evaluated here rather than when the button is pressed so
   * the screen can disable a control and say why, instead of offering an
   * action that will be refused. It costs a few queries per row, which is
   * affordable for a page of a bin and is not a hot path.
   */
  async findAll(query: ListBinDto): Promise<BinRow[]> {
    // `BIN_KINDS` is a readonly tuple, so the union survives the spread and
    // `rowsFor` still receives a BinKind rather than a widened string.
    const kinds: readonly BinKind[] = query.kind ? [query.kind] : BIN_KINDS;

    const rows = await Promise.all(
      kinds.map((kind) => this.rowsFor(kind, query)),
    );

    return rows
      .flat()
      .sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
      .slice(0, query.limit);
  }

  /** The tab counts, without loading or grading a single row. */
  async summary(): Promise<BinSummary> {
    return Promise.all(
      BIN_KINDS.map(async (kind) => {
        const definition = BIN_DEFINITIONS[kind];

        return {
          kind,
          label: definition.label,
          count: await this.dataSource.manager.count(definition.entity, {
            where: { deleted_at: Not(IsNull()) },
            withDeleted: true,
          }),
        };
      }),
    );
  }

  /** FR-BIN-02 */
  async restore(
    kind: BinKind,
    id: number,
    actor: AuthenticatedUser,
    body?: RestoreBinDto,
    ip?: string,
  ): Promise<void> {
    const definition = BIN_DEFINITIONS[kind];

    await this.dataSource.transaction(async (manager) => {
      const row = await this.loadDeletedOrFail(manager, kind, id);

      const blocked = await definition.restoreBlocker(row, manager);
      if (blocked) refuse(blocked);

      if (kind === 'contract') {
        const preview = await this.funding.contractRestorePreview(id);

        if (preview) {
          if (
            !body?.fundings ||
            body.fundings.length !== preview.fundings.length
          ) {
            throw new BadRequestException({
              statusCode: 400,
              error: 'Bad Request',
              message:
                'This contract was investor-funded when it was deleted. Choose who should carry each stake before restoring it.',
            });
          }

          await this.funding.reassignFundingsOnRestore(
            manager,
            id,
            body.fundings,
            actor,
          );
        }
      }

      await manager.restore(definition.entity, { id });

      await definition.afterRestore?.(row, manager);
    });

    await this.audit.record({
      actor_id: actor.id,
      entity: kind,
      entity_id: String(id),
      action: 'restore',
      after: body?.fundings ? { fundings: body.fundings } : undefined,
      ip,
    });
  }

  /** FR-BIN-02. Funding lines frozen at delete, for the restore dialog. */
  contractRestorePreview(contractId: number) {
    return this.funding.contractRestorePreview(contractId);
  }

  /** FR-BIN-03. Capital returning to each funder on a Recycle Bin purge. */
  contractPurgePreview(contractId: number) {
    return this.funding.previewPurgeReturn(contractId);
  }

  /**
   * FR-BIN-03. Permanent, and the only place in the application that deletes
   * anything for good.
   *
   * The typed confirmation lives on the screen; what is enforced here is that
   * the record is genuinely deleted first — purging something still in service
   * would be a hard delete wearing a different name.
   */
  async purge(
    kind: BinKind,
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const definition = BIN_DEFINITIONS[kind];

    // Captured before the row is gone: the audit entry is the only thing that
    // will remain, so it has to carry enough to say what was destroyed.
    let snapshot: Record<string, unknown> = {};

    await this.dataSource.transaction(async (manager) => {
      const row = await this.loadDeletedOrFail(manager, kind, id);

      const blocked = await definition.purgeBlocker(row, manager);
      if (blocked) refuse(blocked);

      snapshot = { ...row, ...definition.describe(row) };

      await definition.purge(row, manager, actor);
    });

    await this.audit.record({
      actor_id: actor.id,
      entity: kind,
      entity_id: String(id),
      action: 'purge',
      before: snapshot,
      ip,
    });
  }

  // -------------------------------------------------------- internals --

  private async rowsFor(kind: BinKind, query: ListBinDto): Promise<BinRow[]> {
    const definition = BIN_DEFINITIONS[kind];
    const manager = this.dataSource.manager;

    const rows = await manager.find(definition.entity, {
      where: {
        // Both conditions on one key: spreading a second `deleted_at` would
        // silently replace the first rather than adding to it.
        deleted_at: query.from
          ? And(Not(IsNull()), MoreThanOrEqual(new Date(query.from)))
          : Not(IsNull()),
      },
      withDeleted: true,
      order: { deleted_at: 'DESC' },
      take: query.limit,
      // Whatever `describe` needs, loaded with the row rather than per row.
      relations: definition.relations,
    });

    return Promise.all(
      rows.map(async (row) => {
        const described = definition.describe(row);

        return {
          kind,
          id: row.id,
          ...described,
          // Non-null by the `Not(IsNull())` above; every row here is deleted.
          deleted_at: (row.deleted_at as Date).toISOString(),
          restore_blocked: await definition.restoreBlocker(row, manager),
          purge_blocked: await definition.purgeBlocker(row, manager),
        };
      }),
    );
  }

  private async loadDeletedOrFail(
    manager: EntityManager,
    kind: BinKind,
    id: number,
  ): Promise<BinRecord> {
    const definition = BIN_DEFINITIONS[kind];

    const row = await manager.findOne(definition.entity, {
      where: { id, deleted_at: Not(IsNull()) },
      withDeleted: true,
      relations: definition.relations,
    });

    if (!row) {
      throw new NotFoundException(
        `No deleted ${definition.label.toLowerCase()} with id ${id}`,
      );
    }

    return row;
  }
}
