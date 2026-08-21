import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities';

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
}
