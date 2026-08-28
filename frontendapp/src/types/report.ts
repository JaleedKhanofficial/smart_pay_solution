import type { FormState, Paginated } from "./customer";

export type ScoreBand = "green" | "gold" | "red";

/** FR-SUM-01-v2. One deal with every BR-08 column already derived. */
export type SummaryRow = {
    contract_id: number;
    customer_id: number;
    customer_name: string;
    customer_mobile: string;
    customer_cnic: string;
    deal_type: string;
    product_name: string;
    sale_price: string;
    markup_pct: string;
    markup_amount: string;
    plan_months: number;
    down_payment: string;
    status: string;
    start_date: string;
    total_sale: string;
    rem_balance: string;
    investment: string;
    actual_markup_pct: string;
    paid: string;
    outstanding: string;
    pct_completed: string;
    mature_profit: string;
    unmatured_profit: string;
    matured: boolean;
    score: string;
    band: ScoreBand;
    capital_recovery: string;
    markup_component: string;
};

export type PortfolioTotals = {
    deals: number;
    completed: number;
    in_progress: number;
    total_sale: string;
    total_outstanding: string;
    total_paid: string;
    mature_profit: string;
    unmatured_profit: string;
    total_profit: string;
    average_markup_pct: string;
    /** BR-25. Outstanding net of what is owed onward to the funders. */
    house_outstanding: string;
    /** BR-25. Unmatured profit the house itself stands to keep. */
    house_unmatured_profit: string;
    /** BR-25, replacing BR-10: own capital only, house figures only. */
    net_balance: string;
};

/** FR-SUM-11. Every investor's position added up — what BR-25 nets out. */
export type InvestorPosition = {
    investors: number;
    deposited: string;
    withdrawn: string;
    net_principal: string;
    principal_deployed: string;
    profit_deployed: string;
    deployed: string;
    available: string;
    lifetime_profit: string;
    payable: string;
};

export type Entry = {
    id: number;
    amount: string;
    period_label: string;
    note: string | null;
    entered_by: number;
    entered_by_name: string;
    created_at: string;
};

export type DealTypeShare = {
    deal_type: string;
    deals: number;
    share_pct: string;
    total_sale: string;
};

export type MissingData = {
    no_mobile: { customer_id: number; customer_name: string }[];
    no_cnic: { customer_id: number; customer_name: string }[];
};

/** FR-SUM-07. A client aggregated across every deal they hold. */
export type ClientProfile = {
    customer_id: number;
    customer_name: string;
    customer_mobile: string;
    customer_cnic: string;
    deals: number;
    completed: number;
    total_sale: string;
    total_paid: string;
    total_outstanding: string;
    mature_profit: string;
    unmatured_profit: string;
    /** Weighted by deal value, not a flat average across deals. */
    score: string;
    band: ScoreBand;
    deals_detail: SummaryRow[];
};

export type Summary = {
    rows: Paginated<SummaryRow>;
    /** Portfolio-wide, not the page — narrowing the table does not move these. */
    totals: PortfolioTotals;
    /** FR-SUM-11. The investor side of BR-25. */
    investors: InvestorPosition;
    capital: { total: string; entries: Entry[] };
    expenses: { total: string; entries: Entry[] };
    deal_types: DealTypeShare[];
    missing: MissingData;
    /** FR-SUM-07. Null until there is a deal to rank. */
    top_performer: ClientProfile | null;
    generated_at: string;
};

export const SEARCH_SCOPES = ["all", "name", "mobile", "cnic"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export const SORT_FIELDS = [
    "customer_name",
    "sale_price",
    "paid",
    "pct_completed",
    "score",
    "outstanding",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";
export type SummarySort = { field: SortField; dir: SortDirection };

export const DEFAULT_SORT: SummarySort = { field: "customer_name", dir: "asc" };

export type SummaryFilterValues = { search: string; scope: string };
export const EMPTY_FILTERS: SummaryFilterValues = { search: "", scope: "all" };

export type { FormState, Paginated };
