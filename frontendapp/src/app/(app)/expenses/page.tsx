import type { Metadata } from "next";
import ExpensesManager from "./expenses-manager";
import { apiCall } from "@/lib/api";
import {
    EMPTY_FILTERS,
    type Expense,
    type ExpenseFilterValues,
    type ExpensePeriod,
} from "@/types/expense";

export const metadata: Metadata = {
    title: "Expenses · SmartPay Solutions",
    description: "What the business spends, and who carries it",
};

type SearchParams = Partial<Record<keyof ExpenseFilterValues, string>>;

/**
 * Module 15 (SRS §4.15). Admin only — a common split names every investor and
 * what they owe, which is investor data by any reading of NFR-15.
 */
export default async function ExpensesPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: ExpenseFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof ExpenseFilterValues)[]).map(
                (key) => [key, params[key]?.trim() ?? ""]
            )
        ),
    };

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }

    let expenses: Expense[] = [];
    let loadError: string | null = null;

    try {
        expenses = await apiCall<Expense[]>(
            query.toString() ? `/expenses?${query.toString()}` : "/expenses"
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load the expenses: ${error.message}`
                : "Could not load the expenses.";
    }

    // The periods drive the roster panel, the expense form's period picker and
    // the filter; the investor lookup drives the other two pickers. A failed
    // read costs those controls their options and nothing else — the register
    // underneath still renders.
    const [periods, investors] = await Promise.all([
        apiCall<ExpensePeriod[]>("/expenses/periods").catch(
            () => [] as ExpensePeriod[]
        ),
        apiCall<{ id: number; label: string }[]>("/investors/lookup").catch(
            () => [] as { id: number; label: string }[]
        ),
    ]);

    // The roster a new common expense would be divided between: the newest
    // open period's carrying members.
    const current = periods.find((period) => !period.closed);
    const sharedBetween =
        current?.members.filter((member) => !member.waived).length ?? 0;

    return (
        <ExpensesManager
            expenses={expenses}
            investors={investors}
            sharedBetween={sharedBetween}
            filters={filters}
            loadError={loadError}
        />
    );
}
