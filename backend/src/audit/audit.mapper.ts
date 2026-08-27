import type { AuditLog } from '../database/entities';

/** One field that moved, as FR-AUD-01's "before/after diff". */
export type AuditChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type AuditEntryResponse = {
  id: number;
  actor_id: number | null;
  /** Null where there was no signed-in actor — a failed login, say. */
  actor_name: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  /**
   * Only the fields that actually moved. The full snapshots are still below
   * for anything the diff cannot express, but a reader almost always wants
   * "what changed", not two objects to compare by eye.
   */
  changes: AuditChange[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

/**
 * Fields that move on every write and carry no information about the change
 * itself. Leaving them in would put `updated_at` at the top of every diff.
 */
const NOISE = new Set(['updated_at', 'created_at']);

/**
 * A shallow diff. Values are compared by their JSON, so a nested object counts
 * as one changed field rather than being walked — which is the right grain
 * here: `guarantors` changing is the fact, not which of its twelve columns.
 */
export function diff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditChange[] {
  // A create has no before and a delete has no after; in both cases the
  // snapshot *is* the story and a field-by-field diff would just restate it.
  if (!before || !after) return [];

  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: AuditChange[] = [];

  for (const field of fields) {
    if (NOISE.has(field)) continue;

    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes.push({ field, before: before[field], after: after[field] });
    }
  }

  return changes.sort((a, b) => a.field.localeCompare(b.field));
}

export function toAuditEntryResponse(row: AuditLog): AuditEntryResponse {
  return {
    id: row.id,
    actor_id: row.actor_id,
    actor_name: row.actor?.name ?? null,
    entity: row.entity,
    entity_id: row.entity_id,
    action: row.action,
    changes: diff(row.before, row.after),
    before: row.before,
    after: row.after,
    ip: row.ip,
    created_at: row.created_at.toISOString(),
  };
}
