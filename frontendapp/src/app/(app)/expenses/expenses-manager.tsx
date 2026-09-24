"use client";

import { useState, useTransition } from "react";
import { deleteExpense } from "./actions";
import { ExpenseForm } from "./expense-form";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { CARD_CLASS, Card, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import type {
    Expense,
    ExpenseFilterValues,
    ExpenseKind,
} from "@/types/expense";

type Props = {
    expenses: Expense[];
    investors: { id: number; label: string }[];
    /** How many investors a common expense is divided between right now. */
    sharedBetween: number;
    filters: ExpenseFilterValues;
    loadError: string | null;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string | number): string {
    const amount = Number(value);

    return Number.isFinite(amount)
        ? `Rs. ${money.format(amount)}`
        : String(value);
}

function total(rows: Expense[]): number {
    return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

const FIELD =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none";

const TH = "px-4 py-3 font-medium";
const TD = "px-4 py-2.5";

/** One of the two lists. Declared at module level for the React Compiler. */
function ExpenseTable({
    rows,
    showInvestor,
    busyId,
    onEdit,
    onRemove,
}: {
    rows: Expense[];
    showInvestor: boolean;
    busyId: number | null;
    onEdit: (expense: Expense) => void;
    onRemove: (expense: Expense) => void;
}) {
    const columns = showInvestor ? 6 : 5;

    return (
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                    <th className={TH}>Sr #</th>
                    <th className={TH}>Date</th>
                    {showInvestor ? <th className={TH}>Investor</th> : null}
                    <th className={TH}>Description</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={`${TH} text-right`}>Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                    <tr>
                        <td
                            colSpan={columns}
                            className="px-4 py-10 text-center text-muted"
                        >
                            Nothing here yet.
                        </td>
                    </tr>
                ) : (
                    rows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-surface-muted">
                            <td className={`${TD} tabular-nums text-muted`}>
                                {index + 1}
                            </td>
                            <td
                                className={`${TD} whitespace-nowrap tabular-nums`}
                            >
                                {formatDate(row.spent_on)}
                            </td>
                            {showInvestor ? (
                                <td className={TD}>{row.investor_name}</td>
                            ) : null}
                            <td className={TD}>
                                {row.description}
                                {row.remarks ? (
                                    <span className="block text-xs text-muted">
                                        {row.remarks}
                                    </span>
                                ) : null}
                            </td>
                            <td
                                className={`${TD} text-right font-medium tabular-nums`}
                            >
                                {pkr(row.amount)}
                            </td>
                            <td className={TD}>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onEdit(row)}
                                        iconOnly
                                        aria-label={`Edit ${row.description}`}
                                        title="Edit"
                                    >
                                        <Icon name="pencil" className="size-4" />
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => onRemove(row)}
                                        disabled={busyId === row.id}
                                        iconOnly
                                        aria-label={`Delete ${row.description}`}
                                        title="Delete"
                                    >
                                        <Icon name="trash" className="size-4" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
            {rows.length > 0 ? (
                <tfoot className="border-t border-border bg-surface-muted font-semibold">
                    <tr>
                        <td colSpan={columns - 2} className={TD}>
                            Total
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                            {pkr(total(rows))}
                        </td>
                        <td />
                    </tr>
                </tfoot>
            ) : null}
        </table>
    );
}

/**
 * Module 15 (SRS §4.15). Two lists and one button.
 *
 * **Common** — bought for the business, divided between the investors.
 * **Individual** — spent on one investor's deal, charged to them.
 *
 * Who shares the common expenses lives on its own page, because it only needs
 * attention when the investors change.
 */
export default function ExpensesManager({
    expenses,
    investors,
    sharedBetween,
    filters,
    loadError,
}: Props) {
    const { confirm, alert } = useAlert();
    const [, startTransition] = useTransition();
    const [busyId, setBusyId] = useState<number | null>(null);

    /** null closed; a kind adds one of that kind; an expense edits it. */
    const [editing, setEditing] = useState<Expense | ExpenseKind | null>(null);

    function saved(message: string) {
        setEditing(null);
        void alert({ title: message, tone: "success" });
    }

    async function remove(expense: Expense) {
        const confirmed = await confirm({
            title: `Delete ${expense.description}?`,
            text: `${pkr(expense.amount)} will be removed.`,
            tone: "warning",
            confirmLabel: "Delete",
            destructive: true,
        });

        if (!confirmed) return;

        setBusyId(expense.id);

        startTransition(async () => {
            const result = await deleteExpense(expense.id);

            setBusyId(null);

            void alert(
                result.ok
                    ? { title: result.message ?? "Deleted", tone: "success" }
                    : {
                          title: "Could not delete",
                          text: result.message ?? undefined,
                          tone: "error",
                      }
            );
        });
    }

    const common = expenses.filter((row) => row.kind === "common");
    const individual = expenses.filter((row) => row.kind === "individual");
    const filtered = Object.values(filters).some(Boolean);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 15"
                title="Expenses"
                description="Common expenses are divided between all investors. Individual expenses are charged to one investor."
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <ButtonLink
                            href="/reports/expenses"
                            variant="secondary"
                            stackOnMobile
                        >
                            <Icon name="barChart" className="size-4" />
                            Report
                        </ButtonLink>
                        <Button
                            onClick={() => setEditing("common")}
                            stackOnMobile
                        >
                            <Icon name="plus" className="size-4" />
                            Add expense
                        </Button>
                    </div>
                }
            />

            {loadError ? (
                <p className="mb-6 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            <form
                action="/expenses"
                method="get"
                className={`mb-6 grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] ${CARD_CLASS}`}
            >
                <input
                    name="search"
                    defaultValue={filters.search}
                    placeholder="Search description or investor"
                    aria-label="Search"
                    className={FIELD}
                />
                <input
                    type="date"
                    name="from"
                    defaultValue={filters.from}
                    aria-label="From date"
                    title="From date"
                    className={FIELD}
                />
                <input
                    type="date"
                    name="to"
                    defaultValue={filters.to}
                    aria-label="To date"
                    title="To date"
                    className={FIELD}
                />
                <Button type="submit" size="sm">
                    <Icon name="search" className="size-4" />
                    Search
                </Button>
                {filtered ? (
                    <ButtonLink href="/expenses" variant="secondary" size="sm">
                        Clear
                    </ButtonLink>
                ) : null}
            </form>

            <Card className="mb-6 overflow-x-auto">
                <CardHeader
                    title="Common expenses"
                    description={
                        sharedBetween > 0
                            ? `Divided between ${sharedBetween} investor${sharedBetween === 1 ? "" : "s"}.`
                            : "Divided between all investors."
                    }
                    actions={
                        <div className="flex gap-2">
                            <ButtonLink
                                href="/expenses/periods"
                                variant="secondary"
                                size="sm"
                            >
                                <Icon name="users" className="size-4" />
                                Who shares
                            </ButtonLink>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditing("common")}
                            >
                                <Icon name="plus" className="size-4" />
                                Add
                            </Button>
                        </div>
                    }
                />
                <ExpenseTable
                    rows={common}
                    showInvestor={false}
                    busyId={busyId}
                    onEdit={setEditing}
                    onRemove={remove}
                />
            </Card>

            <Card className="overflow-x-auto">
                <CardHeader
                    title="Individual expenses"
                    description="Charged to the investor whose deal it was."
                    actions={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditing("individual")}
                        >
                            <Icon name="plus" className="size-4" />
                            Add
                        </Button>
                    }
                />
                <ExpenseTable
                    rows={individual}
                    showInvestor
                    busyId={busyId}
                    onEdit={setEditing}
                    onRemove={remove}
                />
            </Card>

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={
                    typeof editing === "object" && editing !== null
                        ? "Edit expense"
                        : "Add expense"
                }
            >
                {editing !== null ? (
                    <ExpenseForm
                        key={
                            typeof editing === "string" ? editing : editing.id
                        }
                        expense={typeof editing === "string" ? null : editing}
                        startKind={
                            typeof editing === "string" ? editing : editing.kind
                        }
                        investors={investors}
                        onSaved={saved}
                        onCancel={() => setEditing(null)}
                    />
                ) : null}
            </Modal>
        </PageContainer>
    );
}
