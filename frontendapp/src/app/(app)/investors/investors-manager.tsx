"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteInvestor } from "./actions";
import { InvestorForm } from "./investor-form";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CARD_CLASS, Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { StatTile } from "@/components/stat-tile";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { ComboboxField } from "@/components/ui/combobox";
import { downloadInvestorRegisterPdf } from "@/lib/investor-register-pdf";
import type {
    Investor,
    InvestorFilterValues,
    InvestorOption,
    InvestorRow,
    Paginated,
} from "@/types/investor";

type Props = {
    page: Paginated<InvestorRow>;
    filters: InvestorFilterValues;
    loadError: string | null;
    /** Every investor, so the picker is not limited to the page in view. */
    options: InvestorOption[];
    /** The whole filtered set for the PDF, not just the page on screen. */
    exportRows: InvestorRow[];
    /** How many matched but did not fit the export's cap. */
    exportOmitted: number;
    businessName: string;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

export default function InvestorsManager({
    page,
    filters,
    loadError,
    options,
    exportRows,
    exportOmitted,
    businessName,
}: Props) {

    const { confirm, alert } = useAlert();
    const [editing, setEditing] = useState<Investor | "new" | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [, startTransition] = useTransition();

    // Portfolio totals across the page, so the header says something useful
    // even before any contract has been funded.
    const total = (pick: (row: InvestorRow) => string) =>
        page.data.reduce((sum, row) => sum + Number(pick(row)), 0).toFixed(2);

    async function remove(row: InvestorRow) {
        const confirmed = await confirm({
            title: `Remove ${row.full_name}?`,
            text: "Their transaction history stays — the ledger is append-only. Removing is refused while any money is still with the business.",
            tone: "warning",
            confirmLabel: "Yes, remove",
            destructive: true,
        });

        if (!confirmed) return;

        setBusyId(row.id);

        startTransition(async () => {
            const result = await deleteInvestor(row.id);

            setBusyId(null);

            void alert(
                result.ok
                    ? { title: result.message ?? "Removed", tone: "success" }
                    : {
                          title: "That investor cannot be removed yet",
                          text: result.message ?? undefined,
                          tone: "error",
                      }
            );
        });
    }

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 13"
                title="Investors"
                description="Capital put into the business by other people. Every balance is derived from the ledger below it, never stored."
                actions={
                    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-start">
                        <DownloadPdfButton
                            disabled={exportRows.length === 0}
                            build={() =>
                                downloadInvestorRegisterPdf(
                                    exportRows,
                                    filters,
                                    businessName,
                                    exportOmitted
                                )
                            }
                        />
                        <Button onClick={() => setEditing("new")} stackOnMobile>
                            <Icon name="plus" className="size-4" />
                            Add investor
                        </Button>
                    </div>
                }
            />


            {page.data.length > 0 ? (
                <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        label="Investors"
                        value={String(page.total)}
                    />
                    <StatTile
                        label="Net capital"
                        value={pkr(total((row) => row.net_principal))}
                        hint="Deposited less withdrawn"
                    />
                    <StatTile
                        label="Idle"
                        value={pkr(total((row) => row.available))}
                        hint="Available to deploy"
                    />
                    <StatTile
                        label="Payable"
                        value={pkr(total((row) => row.payable))}
                        hint="Owed if everything stopped today"
                    />
                </div>
            ) : null}

            <form action="/investors" method="get" className={`mb-6 ${CARD_CLASS}`}>
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
                    <div className="relative">
                        <Icon
                            name="search"
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                        />
                        <input
                            type="search"
                            name="search"
                            defaultValue={filters.search}
                            placeholder="Search name, CNIC or mobile"
                            className={`${controlClass} pl-9`}
                        />
                    </div>

                    {/*
                        Type-to-filter, listing every investor rather than the
                        page in view — otherwise picking someone on page two
                        would be impossible. The search box above still matches
                        loosely across name, CNIC and mobile; this one names an
                        exact person, which is a different question.

                        It works in this plain GET form because the visible box
                        carries only the search text and has no `name`; the
                        hidden field submits `investor_id`.
                    */}
                    <ComboboxField
                        label=""
                        name="investor_id"
                        placeholder="Any investor"
                        defaultValue={filters.investor_id}
                        options={[
                            { value: "", label: "Any investor" },
                            ...options.map((option) => ({
                                value: String(option.id),
                                label: option.label,
                            })),
                        ]}
                    />

                    <select
                        name="status"
                        defaultValue={filters.status}
                        className={controlClass}
                        aria-label="Status"
                    >
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <div className="flex gap-2">
                        <Button type="submit">Apply</Button>
                        {filters.search || filters.status || filters.investor_id ? (
                            <ButtonLink
                                href="/investors"
                                variant="secondary"
                                iconOnly
                                aria-label="Clear filters"
                                title="Clear"
                            >
                                <Icon name="close" className="size-4" />
                            </ButtonLink>
                        ) : null}
                    </div>
                </div>
            </form>

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            <Card className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="w-16 px-4 py-3 font-medium">
                                Sr. No.
                            </th>
                            <th className="px-4 py-3 font-medium">Investor</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Net capital
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Profit earned
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Deployed
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Idle
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Payable
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {page.data.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-14 text-center">
                                    <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                                        <Icon name="users" className="size-5" />
                                    </span>
                                    <p className="text-sm font-medium text-foreground">
                                        {filters.search || filters.status
                                            ? "No investor matches these filters"
                                            : "No investors yet"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted">
                                        Add one to start recording capital put
                                        into the business.
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            page.data.map((row, index) => (
                                <tr
                                    key={row.id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    {/* Counts on through the register rather
                                        than restarting at 1 on page two, so a
                                        serial number means the same thing
                                        whichever page it is read from. */}
                                    <td className="px-4 py-3 tabular-nums">
                                        {(page.page - 1) * page.page_size + index + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/investors/${row.id}`}
                                            className="font-medium underline-offset-2 hover:underline"
                                        >
                                            {row.full_name}
                                        </Link>
                                        <p className="flex items-center gap-1.5 text-xs tabular-nums text-muted">
                                            {row.cnic_number}
                                            {row.status === "inactive" ? (
                                                <Badge tone="neutral">
                                                    inactive
                                                </Badge>
                                            ) : null}
                                            {row.loss_participation ? null : (
                                                <Badge tone="neutral">
                                                    no loss share
                                                </Badge>
                                            )}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.net_principal)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.lifetime_profit)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.deployed)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.available)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                                        {pkr(row.payable)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <ButtonLink
                                                href={`/investors/${row.id}`}
                                                variant="secondary"
                                                size="sm"
                                                iconOnly
                                                aria-label={`Open ${row.full_name}`}
                                                title="Open"
                                            >
                                                <Icon
                                                    name="chevronRight"
                                                    className="size-4"
                                                />
                                            </ButtonLink>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setEditing(row)}
                                                iconOnly
                                                aria-label={`Edit ${row.full_name}`}
                                                title="Edit"
                                            >
                                                <Icon
                                                    name="pencil"
                                                    className="size-4"
                                                />
                                            </Button>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => remove(row)}
                                                disabled={busyId === row.id}
                                                iconOnly
                                                aria-label={`Remove ${row.full_name}`}
                                                title="Remove"
                                            >
                                                <Icon
                                                    name="trash"
                                                    className="size-4"
                                                />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>

            {page.total_pages > 1 ? (
                <nav className="mt-4 flex items-center justify-end gap-2 text-xs text-muted">
                    {page.page > 1 ? (
                        <ButtonLink
                            href={`/investors?page=${page.page - 1}`}
                            variant="secondary"
                            size="sm"
                            iconOnly
                            aria-label="Previous page"
                        >
                            <Icon name="chevronLeft" className="size-4" />
                        </ButtonLink>
                    ) : null}
                    <span>
                        Page {page.page} of {page.total_pages}
                    </span>
                    {page.page < page.total_pages ? (
                        <ButtonLink
                            href={`/investors?page=${page.page + 1}`}
                            variant="secondary"
                            size="sm"
                            iconOnly
                            aria-label="Next page"
                        >
                            <Icon name="chevronRight" className="size-4" />
                        </ButtonLink>
                    ) : null}
                </nav>
            ) : null}

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={
                    editing === null || editing === "new"
                        ? "Add investor"
                        : `Edit ${editing.full_name}`
                }
                description={
                    editing === null || editing === "new"
                        ? "Their capital is recorded as deposits once they exist."
                        : editing.cnic_number
                }
            >
                {editing !== null ? (
                    <InvestorForm
                        key={editing === "new" ? "new" : editing.id}
                        investor={editing === "new" ? null : editing}
                        onSaved={(message) => {
                            setEditing(null);
                            void alert({ title: message, tone: "success" });
                        }}
                        onCancel={() => setEditing(null)}
                    />
                ) : null}
            </Modal>
        </PageContainer>
    );
}
