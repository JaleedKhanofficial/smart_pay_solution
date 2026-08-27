import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, type Paginated } from '../common/pagination';
import { AuditLog } from '../database/entities';
import { toAuditEntryResponse, type AuditEntryResponse } from './audit.mapper';
import { ListAuditDto } from './dto/list-audit.dto';

/** Anything a module wants to keep a record of; `before`/`after` are snapshots. */
export type AuditEntry = {
  actor_id?: number | null;
  entity: string;
  entity_id?: string | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
};

/**
 * Append-only audit trail (FR-AUD-01). Module 11 adds the admin-facing viewer;
 * writes start here so no module has to be retrofitted later.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      // create + save rather than insert: TypeORM's insert payload type is a
      // deep partial, which cannot express an arbitrary JSON object.
      await this.auditLogs.save(
        this.auditLogs.create({
          actor_id: entry.actor_id ?? null,
          entity: entry.entity,
          entity_id: entry.entity_id ?? null,
          action: entry.action,
          before: entry.before ?? null,
          after: entry.after ?? null,
          ip: entry.ip ?? null,
        }),
      );
    } catch (error) {
      // Never let audit bookkeeping fail the business operation it describes.
      // Callers that must not lose the row should write it inside their own
      // transaction instead.
      this.logger.error(
        `Failed to write audit row (${entry.entity}/${entry.action})`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  // ------------------------------------------------------------ reads --

  /**
   * FR-AUD-02. Newest first, filterable, paginated.
   *
   * Passing `entity` with `entity_id` gives one record's whole history, which
   * is what a detail screen links to — the same query, narrowed.
   */
  async findAll(query: ListAuditDto): Promise<Paginated<AuditEntryResponse>> {
    const qb = this.auditLogs
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor');

    if (query.entity) {
      qb.andWhere('log.entity = :entity', { entity: query.entity });
    }

    if (query.entity_id) {
      qb.andWhere('log.entity_id = :entity_id', { entity_id: query.entity_id });
    }

    if (query.actor_id) {
      qb.andWhere('log.actor_id = :actor_id', { actor_id: query.actor_id });
    }

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.from) {
      qb.andWhere('log.created_at >= :from', { from: query.from });
    }

    if (query.to) {
      // The bound is a date but the column is a timestamp, so an inclusive
      // "to" has to reach the end of that day rather than its midnight.
      qb.andWhere("log.created_at < (CAST(:to AS date) + INTERVAL '1 day')", {
        to: query.to,
      });
    }

    const [rows, total] = await qb
      .orderBy('log.created_at', query.dir === 'asc' ? 'ASC' : 'DESC')
      .addOrderBy('log.id', query.dir === 'asc' ? 'ASC' : 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();

    return paginate(
      rows.map(toAuditEntryResponse),
      total,
      query.page,
      query.page_size,
    );
  }

  /**
   * The values actually present in the log, for the filter dropdowns. Reading
   * them from the data rather than from a hard-coded list means a new action
   * appears in the filter the first time it is recorded, with nothing to keep
   * in step.
   */
  async facets(): Promise<{
    entities: string[];
    actions: string[];
    actors: { id: number; name: string }[];
  }> {
    const [entities, actions, actors] = await Promise.all([
      this.auditLogs
        .createQueryBuilder('log')
        .select('log.entity', 'value')
        .distinct(true)
        .orderBy('value', 'ASC')
        .getRawMany<{ value: string }>(),
      this.auditLogs
        .createQueryBuilder('log')
        .select('log.action', 'value')
        .distinct(true)
        .orderBy('value', 'ASC')
        .getRawMany<{ value: string }>(),
      this.auditLogs
        .createQueryBuilder('log')
        .innerJoin('log.actor', 'actor')
        .select('actor.id', 'id')
        .addSelect('actor.name', 'name')
        .distinct(true)
        .orderBy('name', 'ASC')
        .getRawMany<{ id: number; name: string }>(),
    ]);

    return {
      entities: entities.map((row) => row.value),
      actions: actions.map((row) => row.value),
      actors,
    };
  }
}
