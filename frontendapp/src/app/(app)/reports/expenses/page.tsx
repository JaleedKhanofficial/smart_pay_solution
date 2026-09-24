import type { Metadata } from "next";
import Link from "next/link";
import { ExpenseReportActions } from "./expense-report-actions";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
    EMPTY_REPORT,
    type Expense,
    type ExpensePeriod,
    type ExpenseReport,
} from "@/types/expense";
import type { BusinessIdentity, Setting } from "@/types/setting";

export const metadata: Metadata = {
    title: "Expense report · SmartPay Solutions",
    description: "Common and individual expenses",
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string | number): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : String(value);
}

function sum(rows: Expense[]): number {
    return rows.reduce((total, row) => total + Number(row.amount), 0);
}

const TH = "px-4 py-3 font-medium";
const TD = "px-4 py-2.5";

/**
 * BR-31. The expense report, laid out the way the business kept it by hand:
 * each common period as a plain list with its total and the share per
 * investor, the individual expenses under the investor they belong to, and
 * the summary of who carries what at the end.
 */
export default async function ExpenseReportPage() {
    let report: ExpenseReport = EMPTY_REPORT;
    let loadError: string | null = null;

    try {
        report = await apiCall<ExpenseReport>("/expenses/report");
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load the expense report: ${error.message}`
                : "Could not load the expense report.";
    }

    const [expenses, periods, business] = await Promise.all([
        apiCall<Expense[]>("/expenses").catch(() => [] as Expense[]),
        apiCall<ExpensePeriod[]>("/expenses/periods").catch(
            () => [] as ExpensePeriod[]
        ),
        apiCall<Setting[]>("/settings")
            .then(
                (settings) =>
                    settings.find((entry) => entry.key === "business_identity")
                        ?.value as BusinessIdentity | undefined
            )
            .catch(() => undefined),
    ]);

    // Oldest first inside each list, the way a sheet is written down.
    const byDate = (a: Expense, b: Expense) =>
        a.spent_on.localeCompare(b.spent_on) || a.id - b.id;

    const orderedPeriods = [...periods].sort(
        (a, b) => a.starts_on.localeCompare(b.starts_on) || a.id - b.id
    );

    const individual = expenses
        .filter((row) => row.kind === "individual")
        .sort(byDate);

    const investorIds = [
        ...new Set(individual.map((row) => row.investor_id ?? 0)),
    ];

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 15"
                title="Expense report"
                description="Common expenses by period, individual expenses by investor, and what each investor carries in total."
                actions={
                    <ExpenseReportActions
                        report={report}
                        expenses={expenses}
                        periods={orderedPeriods}
                        businessName={business?.name ?? "SmartPay Solutions"}
                    />
                }
            />

            {loadError ? (
                <p className="mb-6 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            {/* ------------------------------------------------ common -- */}
            {orderedPeriods.length === 0 ? (
                <Card className="mb-6 px-4 py-10 text-center text-sm text-muted">
                    No common expense period yet.{" "}
                    <Link href="/expenses" className="underline">
                        Open one in the register
                    </Link>
                    .
                </Card>
            ) : (
                orderedPeriods.map((period) => {
                    const rows = expenses
                        .filter(
                            (row) =>
                                row.kind === "common" &&
                                row.period_id === period.id
                        )
                        .sort(byDate);

                    const carrying = period.members.filter(
                        (member) => !member.waived
                    ).length;

                    return (
                        <Card key={period.id} className="mb-6 overflow-x-auto">
                            <CardHeader
                                title={`${period.label} expenses`}
                                description={`${formatDate(period.starts_on)}${
                                    period.ends_on
                                        ? ` to ${formatDate(period.ends_on)}`
                                        : " onwards"
                                }`}
                            />
                            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                                <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                                    <tr>
                                        <th className={TH}>Sr #</th>
                                        <th className={TH}>Date</th>
                                        <th className={TH}>Description</th>
                                        <th className={`${TH} text-right`}>
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-4 py-8 text-center text-muted"
                                            >
                                                Nothing recorded in this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row, index) => (
                                            <tr key={row.id}>
                                                <td
                                                    className={`${TD} tabular-nums text-muted`}
                                                >
                                                    {index + 1}
                                                </td>
                                                <td
                                                    className={`${TD} whitespace-nowrap tabular-nums`}
                                                >
                                                    {formatDate(row.spent_on)}
                                                </td>
                                                <td className={TD}>
                                                    {row.description}
                                                    {row.remarks ? (
                                                        <span className="block text-xs text-muted">
                                                            {row.remarks}
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td
                                                    className={`${TD} text-right tabular-nums`}
                                                >
                                                    {pkr(row.amount)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="border-t border-border bg-surface-muted font-semibold">
                                    <tr>
                                        <td colSpan={3} className={TD}>
                                            Total
                                        </td>
                                        <td
                                            className={`${TD} text-right tabular-nums`}
                                        >
                                            {pkr(period.total)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} className={TD}>
                                            Per investor
                                            <span className="ml-2 text-xs font-normal text-muted">
                                                divided by{" "}
                                                {period.members.length}
                                                {carrying <
                                                period.members.length
                                                    ? ` · ${period.members.length - carrying} waived`
                                                    : ""}
                                            </span>
                                        </td>
                                        <td
                                            className={`${TD} text-right tabular-nums`}
                                        >
                                            {period.members.length > 0
                                                ? pkr(period.per_member)
                                                : "no members"}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </Card>
                    );
                })
            )}

            {/* -------------------------------------------- individual -- */}
            <Card className="mb-6 overflow-x-auto">
                <CardHeader
                    title="Individual expenses"
                    description="Charged whole to the investor whose deal it was."
                />
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className={TH}>Sr #</th>
                            <th className={TH}>Date</th>
                            <th className={TH}>Investor</th>
                            <th className={TH}>Description</th>
                            <th className={`${TH} text-right`}>Amount</th>
                        </tr>
                    </thead>
                    {individual.length === 0 ? (
                        <tbody>
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-4 py-8 text-center text-muted"
                                >
                                    No individual expense recorded.
                                </td>
                            </tr>
                        </tbody>
                    ) : (
                        investorIds.map((investorId) => {
                            const rows = individual.filter(
                                (row) => (row.investor_id ?? 0) === investorId
                            );

                            return (
                                <tbody
                                    key={investorId}
                                    className="divide-y divide-border border-b border-border"
                                >
                                    {rows.map((row, index) => (
                                        <tr key={row.id}>
                                            <td
                                                className={`${TD} tabular-nums text-muted`}
                                            >
                                                {index + 1}
                                            </td>
                                            <td
                                                className={`${TD} whitespace-nowrap tabular-nums`}
                                            >
                                                {formatDate(row.spent_on)}
                                            </td>
                                            <td className={TD}>
                                                {row.investor_name}
                                            </td>
                                            <td className={TD}>
                                                {row.description}
                                                {row.remarks ? (
                                                    <span className="block text-xs text-muted">
                                                        {row.remarks}
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td
                                                className={`${TD} text-right tabular-nums`}
                                            >
                                                {pkr(row.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-surface-muted font-semibold">
                                        <td colSpan={4} className={TD}>
                                            {rows[0]?.investor_name} total
                                        </td>
                                        <td
                                            className={`${TD} text-right tabular-nums`}
                                        >
                                            {pkr(sum(rows))}
                                        </td>
                                    </tr>
                                </tbody>
                            );
                        })
                    )}
                    {individual.length > 0 ? (
                        <tfoot className="bg-surface-muted font-semibold">
                            <tr>
                                <td colSpan={4} className={TD}>
                                    Total individual
                                </td>
                                <td className={`${TD} text-right tabular-nums`}>
                                    {pkr(sum(individual))}
                                </td>
                            </tr>
                        </tfoot>
                    ) : null}
                </table>
            </Card>

            {/* ----------------------------------------------- summary -- */}
            <Card className="overflow-x-auto">
                <CardHeader
                    title="Summary"
                    description="What each investor carries: their share of each common period plus their own."
                />
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className={TH}>Sr #</th>
                            <th className={TH}>Investor</th>
                            {report.periods.map((period) => (
                                <th
                                    key={period.id}
                                    className={`${TH} text-right`}
                                >
                                    {period.label}
                                </th>
                            ))}
                            <th className={`${TH} text-right`}>Individual</th>
                            <th className={`${TH} text-right`}>Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {report.rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={report.periods.length + 4}
                                    className="px-4 py-8 text-center text-muted"
                                >
                                    Nothing to summarise yet.
                                </td>
                            </tr>
                        ) : (
                            report.rows.map((row, index) => (
                                <tr key={row.investor_id}>
                                    <td
                                        className={`${TD} tabular-nums text-muted`}
                                    >
                                        {index + 1}
                                    </td>
                                    <td className={TD}>
                                        <Link
                                            href={`/investors/${row.investor_id}`}
                                            className="font-medium text-foreground hover:underline"
                                        >
                                            {row.investor_name}
                                        </Link>
                                    </td>
                                    {report.periods.map((period) => {
                                        const cell = row.by_period.find(
                                            (entry) =>
                                                entry.period_id === period.id
                                        );

                                        return (
                                            <td
                                                key={period.id}
                                                className={`${TD} text-right tabular-nums`}
                                            >
                                                {cell === undefined
                                                    ? "—"
                                                    : cell.waived
                                                      ? "waived"
                                                      : pkr(cell.share)}
                                            </td>
                                        );
                                    })}
                                    <td
                                        className={`${TD} text-right tabular-nums`}
                                    >
                                        {pkr(row.individual)}
                                    </td>
                                    <td
                                        className={`${TD} text-right font-semibold tabular-nums`}
                                    >
                                        {pkr(row.total)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {report.rows.length > 0 ? (
                        <tfoot className="border-t border-border bg-surface-muted font-semibold">
                            <tr>
                                <td className={TD} />
                                <td className={TD}>Total</td>
                                {report.periods.map((period) => (
                                    <td
                                        key={period.id}
                                        className={`${TD} text-right tabular-nums`}
                                    >
                                        {pkr(
                                            report.rows.reduce(
                                                (total, row) =>
                                                    total +
                                                    Number(
                                                        row.by_period.find(
                                                            (entry) =>
                                                                entry.period_id ===
                                                                period.id
                                                        )?.share ?? 0
                                                    ),
                                                0
                                            )
                                        )}
                                    </td>
                                ))}
                                <td className={`${TD} text-right tabular-nums`}>
                                    {pkr(report.totals.individual)}
                                </td>
                                <td className={`${TD} text-right tabular-nums`}>
                                    {pkr(report.totals.billed)}
                                </td>
                            </tr>
                        </tfoot>
                    ) : null}
                </table>
            </Card>

            {Number(report.totals.absorbed) > 0 ? (
                <p className="mt-4 text-xs text-muted">
                    {pkr(report.totals.absorbed)} of the common expenses is
                    waived and carried by the business, so the summary total is
                    that much less than the total spent (
                    {pkr(report.totals.spent)}).
                </p>
            ) : null}
        </PageContainer>
    );
}
