import type { ContractStatus } from "./contract";

/** How a contract's capital was raised. */
export type Arrangement = "sole" | "joint";

/** FR-IVT-16. One investor's stake in one contract, and what it has returned. */
export type FundingStake = {
    investor_id: number;
    investor_name: string;
    amount: string;
    /** BR-15. Of the contract's cost price. Always 100 on a sole deal. */
    share_pct: string;
    funded_from_principal: string;
    funded_from_profit: string;
    /** BR-23. Drawn on recovered profit rather than fresh principal. */
    reinvested: boolean;
    capital_recovered: string;
    capital_outstanding: string;
    matured_profit: string;
    unmatured_profit: string;
};

/** FR-IVT-16. One funded contract, and who is behind it. */
export type FundingReportRow = {
    contract_id: number;
    reference: string;
    customer_name: string;
    product_name: string;
    status: ContractStatus;
    /** True while the contract sits in the Recycle Bin. */
    deleted: boolean;
    start_date: string;
    end_date: string;
    cost_price: string;
    markup_amount: string;
    arrangement: Arrangement;
    investor_count: number;
    funded: string;
    recovered: string;
    capital_recovered: string;
    capital_outstanding: string;
    /** BR-09. Earned: this deal has returned the capital that was put in. */
    matured_profit: string;
    /** The markup this deal has yet to earn. */
    unmatured_profit: string;
    stakes: FundingStake[];
};

/** FR-IVT-16. One investor across every deal they are in. */
export type InvestorFundingRollup = {
    investor_id: number;
    investor_name: string;
    contracts: number;
    sole: number;
    joint: number;
    funded: string;
    capital_recovered: string;
    capital_outstanding: string;
    matured_profit: string;
    unmatured_profit: string;
};

export type FundingReportTotals = {
    contracts: number;
    sole: number;
    joint: number;
    investors: number;
    funded: string;
    capital_recovered: string;
    capital_outstanding: string;
    matured_profit: string;
    unmatured_profit: string;
};

export type FundingReport = {
    rows: FundingReportRow[];
    investors: InvestorFundingRollup[];
    totals: FundingReportTotals;
    generated_at: string;
};

export type FundingFilterValues = {
    arrangement: string;
    investor_id: string;
    status: string;
    search: string;
};

export const EMPTY_FILTERS: FundingFilterValues = {
    arrangement: "",
    investor_id: "",
    status: "",
    search: "",
};

export const SORT_FIELDS = [
    "contract_id",
    "customer_name",
    "funded",
    "recovered",
    "start_date",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";
export type FundingSort = { field: SortField; dir: SortDirection };

export const DEFAULT_SORT: FundingSort = { field: "contract_id", dir: "desc" };

export const EMPTY_REPORT: FundingReport = {
    rows: [],
    investors: [],
    totals: {
        contracts: 0,
        sole: 0,
        joint: 0,
        investors: 0,
        funded: "0.00",
        capital_recovered: "0.00",
        capital_outstanding: "0.00",
        matured_profit: "0.00",
        unmatured_profit: "0.00",
    },
    generated_at: new Date().toISOString(),
};
