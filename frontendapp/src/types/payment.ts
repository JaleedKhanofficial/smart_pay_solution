import type { FormState, Paginated } from "./customer";

export type PaymentMethod = "Cash" | "Bank Transfer" | "Cheque";

export const PAYMENT_METHODS: PaymentMethod[] = [
    "Cash",
    "Bank Transfer",
    "Cheque",
];

/**
 * SRS §5.9. Money is a string end to end so no figure is rounded through a
 * float. A voided payment is present with `voided_at` and its reason set —
 * FR-PAY-09 strikes it through rather than hiding it.
 */
export type Payment = {
    id: number;
    contract_id: number;
    customer_id: number;
    customer_name: string;
    customer_cnic: string;
    product_name: string;
    amount: string;
    payment_date: string;
    method: PaymentMethod;
    note: string | null;
    recorded_by: number;
    recorded_by_name: string;
    void_reason: string | null;
    voided_at: string | null;
    created_at: string;
    updated_at: string;
};

/** FR-PAY-03. A contract that can still take money, with its prefill figures. */
export type CollectableContract = {
    contract_id: number;
    reference: string;
    customer_id: number;
    customer_name: string;
    customer_cnic: string;
    customer_mobile: string;
    product_name: string;
    monthly_installment: string;
    financed_amount: string;
    paid_amount: string;
    outstanding_amount: string;
    next_seq: number | null;
    next_due_date: string | null;
    next_amount: string | null;
    past_due: boolean;
};

/** What a write returns: the receipt, plus where it left the contract. */
export type PaymentWriteResult = {
    payment: Payment;
    contract: {
        id: number;
        status: string;
        paid_amount: string;
        outstanding_amount: string;
        status_changed: boolean;
    };
};

/** Columns the register can be ordered by; mirrors the API whitelist. */
export const SORT_FIELDS = [
    "payment_date",
    "amount",
    "method",
    "created_at",
    "customer",
    "product",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type PaymentSort = { field: SortField; dir: SortDirection };

export const DEFAULT_SORT: PaymentSort = { field: "payment_date", dir: "desc" };

/** Every filter the register accepts, as it appears in the URL. */
export type PaymentFilterValues = {
    search: string;
    contract_id: string;
    method: string;
    paid_from: string;
    paid_to: string;
    voided: string;
};

export const EMPTY_FILTERS: PaymentFilterValues = {
    search: "",
    contract_id: "",
    method: "",
    paid_from: "",
    paid_to: "",
    voided: "",
};

export type { FormState, Paginated };
