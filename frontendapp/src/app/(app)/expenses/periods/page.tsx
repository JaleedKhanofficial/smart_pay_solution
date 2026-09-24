import type { Metadata } from "next";
import PeriodsManager from "./periods-manager";
import { apiCall } from "@/lib/api";
import type { ExpensePeriod } from "@/types/expense";

export const metadata: Metadata = {
    title: "Who shares · Expenses · SmartPay Solutions",
    description: "Which investors the common expenses are divided between",
};

/** BR-28/BR-29. Off the main page: it only matters when the investors change. */
export default async function ExpensePeriodsPage() {
    const [periods, investors] = await Promise.all([
        apiCall<ExpensePeriod[]>("/expenses/periods").catch(
            () => [] as ExpensePeriod[]
        ),
        apiCall<{ id: number; label: string }[]>("/investors/lookup").catch(
            () => [] as { id: number; label: string }[]
        ),
    ]);

    return <PeriodsManager periods={periods} investors={investors} />;
}
