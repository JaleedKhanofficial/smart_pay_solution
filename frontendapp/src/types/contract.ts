import type { FormState, Paginated } from "./customer";

export type ContractStatus = "active" | "completed" | "cancelled";
export type ProductCondition = "New" | "Used";

/** SRS §5.8. One scheduled month of the plan (BR-04-v2, BR-05). */
export type Installment = {
    id: number;
    seq: number;
    due_date: string;
    amount: string;
};

/**
 * SRS §5.7. Money is a string end to end so no figure is rounded through a
 * float. `cost_price` equals `sale_price` — the business applies its markup to
 * what it paid — and both columns are kept because Module 13 measures investor
 * capital against cost (BR-15). `house_funded_amount` on the detail response is
 * the admin-only figure (NFR-15).
 */
export type Contract = {
    id: number;
    customer_id: number;
    customer_name: string;
    customer_cnic: string;
    product_id: number;
    product_name: string;
    cost_price: string;
    sale_price: string;
    markup_pct: string;
    markup_amount: string;
    net_amount: string;
    down_payment: string;
    financed_amount: string;
    monthly_installment: string;
    plan_months: number;
    product_condition: ProductCondition;
    start_date: string;
    end_date: string;
    status: ContractStatus;
    write_off: boolean;
    terms_locked_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type ContractDetail = Contract & {
    installments: Installment[];
    house_funded_amount: string | null;
};

/** What POST /contracts/preview returns: the plan, priced but not saved. */
export type ContractPreview = {
    cost_price: string;
    sale_price: string;
    retail_margin: string;
    markup_pct: string;
    markup_amount: string;
    net_amount: string;
    down_payment: string;
    financed_amount: string;
    monthly_installment: string;
    plan_months: number;
    start_date: string;
    end_date: string;
    schedule: { seq: number; due_date: string; amount: string }[];
};

/** Columns the register can be ordered by; mirrors the API whitelist. */
export const SORT_FIELDS = [
    "created_at",
    "start_date",
    "end_date",
    "sale_price",
    "financed_amount",
    "status",
    "customer",
    "product",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type ContractSort = { field: SortField; dir: SortDirection };

export const DEFAULT_SORT: ContractSort = { field: "created_at", dir: "desc" };

/** Every filter the register accepts, as it appears in the URL. */
export type ContractFilterValues = {
    search: string;
    status: string;
    customer_id: string;
    product_id: string;
    due: string;
    started_from: string;
    started_to: string;
};

export const EMPTY_FILTERS: ContractFilterValues = {
    search: "",
    status: "",
    customer_id: "",
    product_id: "",
    due: "",
    started_from: "",
    started_to: "",
};

export type { FormState, Paginated };
