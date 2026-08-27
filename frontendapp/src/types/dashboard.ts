/** FR-DSH-09. A recent collection, with enough context to recognise it. */
export type RecentPayment = {
    id: number;
    contract_id: number;
    customer_name: string;
    product_name: string;
    amount: string;
    payment_date: string;
    method: string;
};

/**
 * FR-DSH-01..12. One payload; the whole screen renders from it.
 *
 * Every figure is derived from the payments and installments tables, so the
 * dashboard cannot disagree with the contract screen or the ledger — the fault
 * v1 had (§9.3 item 1).
 */
export type Dashboard = {
    collections: { today: string; month: string; all_time: string };
    outstanding: string;
    mature_profit: string;
    unmatured_profit: string;
    counts: {
        active_plans: number;
        active_products: number;
        customers: number;
        contracts: number;
    };
    recent_payments: RecentPayment[];
    past_due_contracts: number;
    generated_at: string;
};
