import type { Paginated } from "./customer";

export type TierKey =
    | "platinum"
    | "gold"
    | "silver"
    | "caution"
    | "awaiting";

/** FR-REC-01-v2. One contract seen through its recovery health. */
export type RecoveryRow = {
    contract_id: number;
    reference: string;
    customer_id: number;
    customer_name: string;
    customer_cnic: string;
    customer_mobile: string;
    product_name: string;
    status: string;
    financed_amount: string;
    paid: string;
    outstanding: string;
    recovered_pct: string;
    completed_installments: number;
    plan_months: number;
    /** Positive is lag, negative is advance, netted across completed rows. */
    net_days: number;
    tier_key: TierKey;
    tier_label: string;
    past_due: boolean;
};

export type RecoveryTotals = {
    contracts: number;
    past_due: number;
    settled: number;
    total_outstanding: string;
    /** Weighted by financed amount, not a mean of percentages. */
    recovered_pct: string;
    by_tier: { tier_key: TierKey; tier_label: string; count: number }[];
};

export type Recovery = {
    rows: Paginated<RecoveryRow>;
    totals: RecoveryTotals;
};

/** FR-REC-08. An archived ledger; never editable. */
export type Snapshot = {
    id: number;
    contract_id: number | null;
    snapshot_no: string;
    created_by: number;
    created_by_name: string;
    legacy: boolean;
    created_at: string;
};

export const SORT_FIELDS = [
    "customer",
    "recovered_pct",
    "net_days",
    "outstanding",
    "tier",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";
export type RecoverySort = { field: SortField; dir: SortDirection };

export const DEFAULT_SORT: RecoverySort = { field: "net_days", dir: "desc" };

export type RecoveryFilterValues = {
    search: string;
    tier: string;
    health: string;
};

export const EMPTY_FILTERS: RecoveryFilterValues = {
    search: "",
    tier: "",
    health: "",
};

export type { Paginated };
