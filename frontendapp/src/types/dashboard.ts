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
    /** FR-DSH-13. Set when the figures are one investor's; null for all. */
    investor: { id: number; full_name: string } | null;
    /**
     * FR-DSH-16. The period the figures describe, or nulls for everything.
     * Flows (collections, contracts started, customers added, the chart) are
     * what happened inside it; balances are as at its last day.
     */
    period: { from: string | null; to: string | null };
    /** BR-24. Deposits less withdrawals, adjustments and losses. */
    net_capital: string;
    collections: {
        today: string;
        month: string;
        all_time: string;
        /** FR-DSH-16. Inside the period; null when there is none. */
        period: string | null;
    };
    outstanding: string;
    mature_profit: string;
    unmatured_profit: string;
    counts: {
        active_plans: number;
        customers: number;
        contracts: number;
        /** Module 13. Whose capital is buying the stock. */
        investors: number;
        active_investors: number;
    };
    recent_payments: RecentPayment[];
    past_due_contracts: number;
    /**
     * FR-DSH-15. Collections by month over the last twelve, one series per
     * investor whose money the contracts were bought with — or the one
     * investor's alone when filtered. Every month is present, zero or not.
     */
    collections_by_month: {
        months: string[];
        series: {
            investor_id: number;
            investor_name: string;
            values: string[];
        }[];
    };
    /**
     * FR-DSH-17. The same figures for the period and the one before it, so
     * a tile can say "▲ 12% vs last month". Null when there is nothing
     * sensible to compare against.
     */
    comparison: {
        current: Figures;
        previous: Figures;
        current_label: string;
        previous_label: string;
    } | null;
    /** FR-DSH-18. One card per funding investor; empty when filtered to one. */
    scorecards: {
        investor_id: number;
        investor_name: string;
        status: "active" | "inactive";
        contracts: number;
        net_capital: string;
        collected: string;
        collected_before: string | null;
        outstanding: string;
        mature_profit: string;
        on_time: Rate;
        collection: Rate;
    }[];
    /** FR-DSH-19. What came in, by how it was paid. */
    collections_by_method: { method: string; amount: string; count: number }[];
    /** FR-DSH-20. The portfolio as percentages, each with its two numbers. */
    rates: {
        on_time: Rate;
        collection: Rate;
        recovered: Rate;
        profit_matured: Rate;
        past_due: Rate;
    };
    generated_at: string;
};

/** FR-DSH-17. The figures a period is compared on. */
export type Figures = {
    collected: string;
    contracts: number;
    customers: number;
    net_capital: string;
    outstanding: string;
    mature_profit: string;
    on_time_pct: string | null;
    collection_pct: string | null;
    recovered_pct: string | null;
    profit_matured_pct: string | null;
    past_due_pct: string | null;
};

/**
 * FR-DSH-20. A percentage and the two numbers behind it. `pct` is null when
 * nothing was measured — 0 of 0 is not 0%.
 */
export type Rate = {
    numerator: string;
    denominator: string;
    pct: string | null;
};
