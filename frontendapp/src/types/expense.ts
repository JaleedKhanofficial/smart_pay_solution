/** SRS §4.15. What the business spends, and who carries it. */

export const EXPENSE_KINDS = ["common", "individual"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

/** One line of spending as the register shows it. */
export type Expense = {
    id: number;
    kind: ExpenseKind;
    period_id: number | null;
    period_label: string | null;
    investor_id: number | null;
    investor_name: string | null;
    spent_on: string;
    description: string;
    amount: string;
    remarks: string | null;
    entered_by_name: string;
};

/** BR-28/BR-29. One investor's place in a period's split. */
export type PeriodMember = {
    investor_id: number;
    investor_name: string;
    waived: boolean;
    waive_reason: string | null;
    share: string;
};

/** BR-28. A period with its members and what it came to. */
export type ExpensePeriod = {
    id: number;
    label: string;
    starts_on: string;
    ends_on: string | null;
    closed: boolean;
    note: string | null;
    expenses: number;
    total: string;
    /** What each carrying member owes out of this pot. */
    per_member: string;
    /** BR-29. What the business carries for the waived members. */
    absorbed: string;
    members: PeriodMember[];
};

/** BR-31. One investor's row in the matrix. */
export type InvestorExpenseRow = {
    investor_id: number;
    investor_name: string;
    by_period: {
        period_id: number;
        label: string;
        share: string;
        waived: boolean;
    }[];
    common_total: string;
    individual: string;
    total: string;
};

export type ExpenseReport = {
    periods: { id: number; label: string; total: string }[];
    rows: InvestorExpenseRow[];
    totals: {
        common: string;
        individual: string;
        /** What the investors carry between them. */
        billed: string;
        /** BR-29. What the business absorbed for waived members. */
        absorbed: string;
        /** Everything spent, however it was carried. */
        spent: string;
    };
    generated_at: string;
};

export const EMPTY_REPORT: ExpenseReport = {
    periods: [],
    rows: [],
    totals: {
        common: "0.00",
        individual: "0.00",
        billed: "0.00",
        absorbed: "0.00",
        spent: "0.00",
    },
    generated_at: new Date().toISOString(),
};

/** The register's filters, as they sit in the query string. */
export type ExpenseFilterValues = {
    kind: string;
    period_id: string;
    investor_id: string;
    from: string;
    to: string;
    search: string;
};

export const EMPTY_FILTERS: ExpenseFilterValues = {
    kind: "",
    period_id: "",
    investor_id: "",
    from: "",
    to: "",
    search: "",
};

export type FormState = {
    ok: boolean;
    message: string | null;
    errors: string[];
    /** Bumped on every submit so an unchanged message still re-announces. */
    attempt: number;
    /** What was typed, so a rejected submission can be re-seeded. */
    values?: Record<string, string>;
};

export const EMPTY_FORM_STATE: FormState = {
    ok: false,
    message: null,
    errors: [],
    attempt: 0,
};
