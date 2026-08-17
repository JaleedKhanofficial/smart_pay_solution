import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditEntry = {
  actorId?: string | null;
  entity: string;
  entityId?: string | null;
  action: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ip?: string | null;
};

/**
 * Append-only audit trail (FR-AUD-01). Module 11 adds the admin-facing viewer;
 * writes start here so no module has to be retrofitted later.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          action: entry.action,
          before: entry.before ?? Prisma.DbNull,
          after: entry.after ?? Prisma.DbNull,
          ip: entry.ip ?? null,
        },
      });
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
