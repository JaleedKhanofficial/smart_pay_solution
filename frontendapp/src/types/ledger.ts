import type { Contract } from "./contract";

export type RowStatus = "Pending" | "Short Paid" | "Paid" | "Advance";

export type BandKey =
    | "early"
    | "on_time"
    | "slight_delay"
    | "late"
    | "very_late"
    | "overdue";

export type TierKey =
    | "platinum"
    | "gold"
    | "silver"
    | "caution"
    | "awaiting";

/** FR-REC-03. One scheduled month, graded. */
export type LedgerRow = {
    seq: number;
    due_date: string;
    required: string;
    applied: string;
    /** `applied - required`; zero or negative, since FIFO never over-applies. */
    variance: string;
    /** |variance| below a rupee — Exact rather than a real shortfall. */
    exact: boolean;
    status: RowStatus;
    /** FR-REC-02-v2: the date of the payment that completed this row. */
    completed_on: string | null;
    completed_by_payment_id: number | null;
    /** Signed: negative means settled before the due date. */
    days_late: number | null;
    band_key: BandKey | null;
    band_label: string | null;
};

export type LedgerSummary = {
    plan_months: number;
    completed_installments: number;
    total_payable: string;
    down_payment: string;
    financed_amount: string;
    total_paid: string;
    outstanding: string;
    recovered_pct: string;
    /** FR-REC-04. Positive is lag, negative is advance, netted across rows. */
    net_days: number;
};

/** BR-07. Advisory on the next contract, never applied automatically. */
export type LoyaltyTier = {
    key: TierKey;
    label: string;
    reduction_pct: number;
    behaviour: string;
    reward: string;
};

export type Ledger = {
    contract: Contract;
    rows: LedgerRow[];
    summary: LedgerSummary;
    tier: LoyaltyTier;
    distribution: { key: BandKey; label: string; count: number }[];
    generated_at: string;
};
