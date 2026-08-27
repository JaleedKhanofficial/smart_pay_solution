import { toAmount, type LedgerReport, type LedgerRow } from '../formulas';
import type { ContractResponse } from './contract.mapper';

/**
 * FR-REC-03. One scheduled month as the screen renders it.
 *
 * Money leaves the formula package as paisa integers and is converted here,
 * once, so the wire carries the same money strings as every other response.
 */
export type LedgerRowResponse = {
  seq: number;
  due_date: string;
  required: string;
  applied: string;
  variance: string;
  exact: boolean;
  status: LedgerRow['status'];
  completed_on: string | null;
  completed_by_payment_id: number | null;
  days_late: number | null;
  band_key: string | null;
  band_label: string | null;
};

/** FR-REC-01-v2 / §7. The whole read-only view of one contract's recovery. */
export type LedgerResponse = {
  contract: ContractResponse;
  rows: LedgerRowResponse[];
  summary: LedgerReport['summary'];
  tier: LedgerReport['tier'];
  distribution: { key: string; label: string; count: number }[];
  /** Stamped by the server so two readings of the same ledger agree. */
  generated_at: string;
};

function toRowResponse(row: LedgerRow): LedgerRowResponse {
  return {
    seq: row.seq,
    due_date: row.due_date,
    required: toAmount(row.required),
    applied: toAmount(row.applied),
    variance: toAmount(row.variance),
    exact: row.exact,
    status: row.status,
    completed_on: row.completed_on,
    completed_by_payment_id: row.completed_by_payment_id,
    days_late: row.days_late,
    band_key: row.band?.key ?? null,
    band_label: row.band?.label ?? null,
  };
}

export function toLedgerResponse(
  contract: ContractResponse,
  report: LedgerReport,
): LedgerResponse {
  return {
    contract,
    rows: report.rows.map(toRowResponse),
    summary: report.summary,
    tier: report.tier,
    distribution: report.distribution.map((entry) => ({
      key: entry.band.key,
      label: entry.band.label,
      count: entry.count,
    })),
    generated_at: new Date().toISOString(),
  };
}
