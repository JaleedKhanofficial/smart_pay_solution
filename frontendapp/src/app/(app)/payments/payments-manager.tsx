"use client";

import Link from "next/link";
import { useState } from "react";
import { PaymentFilters } from "./payment-filters";
import { PaymentForm } from "./payment-form";
import { VoidPaymentDialog } from "./void-payment-dialog";
import { FlashAlert } from "@/components/flash-alert";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatDate, formatDateTime } from "@/lib/format";
import {
    DEFAULT_SORT,
    type CollectableContract,
    type Paginated,
    type Payment,
    type PaymentFilterValues,
    type PaymentSort,
    type SortDirection,
    type SortField,
} from "@/types/payment";

type Props = {
    page: Paginated<Payment>;
    filters: PaymentFilterValues;
    sort: PaymentSort;
    collectable: CollectableContract[];
    flash?: string;
    loadError: string | null;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** NFR-02: PKR, en-PK grouping, no decimals on screen. */
function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

function EmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="text-center">
            <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                <Icon name="creditCard" className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
                {filtered
                    ? "No payments match these filters"
                    : "No payments recorded yet"}
            </p>
            <p className="mt-1 text-xs text-muted">
                {filtered
                    ? "Try widening or clearing the filters."
                    : "Record the first collection against an active contract."}
            </p>
        </div>
    );
}

/**
 * Declared at module level: defining it inside the manager would recreate the
 * component on every render, which the React Compiler rejects.
 */
function SortableHeader({
    field,
    label,
    sort,
    hrefFor,
    className = "",
}: {
    field: SortField;
    label: string;
    sort: PaymentSort;
    hrefFor: (field: SortField, dir: SortDirection) => string;
    className?: string;
}) {
    const active = sort.field === field;
    const nextDir: SortDirection = active && sort.dir === "asc" ? "desc" : "asc";

    return (
        <th
            className={`px-4 py-3 font-medium ${className}`}
            aria-sort={
                active
                    ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                    : "none"
            }
        >
            <Link
                href={hrefFor(field, nextDir)}
                className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                    active ? "text-foreground" : ""
                }`}
            >
                {label}
                <Icon
                    name={
                        active && sort.dir === "asc" ? "chevronUp" : "chevronDown"
                    }
                    className={`size-3.5 ${
                        active ? "text-brand-ink" : "text-muted/40"
                    }`}
                />
            </Link>
        </th>
    );
}

export default function PaymentsManager({
    page,
    filters,
    sort,
    collectable,
    flash,
    loadError,
}: Props) {
    const activeFilters = Object.values(filters).filter(Boolean).length;
    const filtered = activeFilters > 0;
    const { alert } = useAlert();

    const [collecting, setCollecting] = useState(false);
    const [voiding, setVoiding] = useState<Payment | null>(null);

    function handleSaved(message: string) {
        setCollecting(false);
        void alert({ title: "Payment recorded", text: message, tone: "success" });
    }

    function handleVoided(message: string) {
        setVoiding(null);
        void alert({ title: "Payment voided", text: message, tone: "success" });
    }

    function hrefWith(overrides: {
        page?: number;
        sort?: SortField;
        dir?: SortDirection;
    }): string {
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(filters)) {
            if (value) params.set(key, value);
        }

        const field = overrides.sort ?? sort.field;
        const dir = overrides.dir ?? sort.dir;

        // The default (newest payment first) is the bare URL.
        if (field !== DEFAULT_SORT.field || dir !== DEFAULT_SORT.dir) {
            params.set("sort", field);
            params.set("dir", dir);
        }

        const target = overrides.page ?? page.page;
        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/payments?${query}` : "/payments";
    }

    const pageHref = (target: number) => hrefWith({ page: target });
    const sortHref = (field: SortField, dir: SortDirection) =>
        hrefWith({ sort: field, dir, page: 1 });

    const from = (page.page - 1) * page.page_size + 1;
    const to = Math.min(page.page * page.page_size, page.total);

    const contractOptions = collectable.map((row) => ({
        value: String(row.contract_id),
        label: `${row.reference} · ${row.customer_name}`,
    }));

    // FR-DSH-12's reading, surfaced where collections actually happen.
    const overdue = collectable.filter((row) => row.past_due).length;

    return (
        <PageContainer>
            <FlashAlert message={flash} cleanUrl={pageHref(page.page)} />

            <PageHeader
                eyebrow="Module 6"
                title="Payments"
                description={
                    page.total === 0
                        ? "No collections recorded yet."
                        : `${page.total} payment${page.total === 1 ? "" : "s"}${
                              filtered ? " matching the filters" : ""
                          }`
                }
                actions={
                    <Button
                        onClick={() => setCollecting(true)}
                        disabled={collectable.length === 0}
                        title={
                            collectable.length === 0
                                ? "No contract has a balance to collect"
                                : undefined
                        }
                        stackOnMobile
                    >
                        <Icon name="plus" className="size-4" />
                        Record payment
                    </Button>
                }
            />

            {overdue > 0 ? (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-negative/30 bg-negative/8 px-4 py-3">
                    <Icon
                        name="alert"
                        className="mt-0.5 size-4 shrink-0 text-negative"
                    />
                    <p className="text-sm text-foreground">
                        <span className="font-medium">
                            {overdue} contract{overdue === 1 ? " has" : "s have"}{" "}
                            an installment past due.
                        </span>{" "}
                        <Link
                            href="/contracts?due=past_due"
                            className="text-muted underline-offset-4 hover:underline"
                        >
                            See them in the register
                        </Link>
                    </p>
                </div>
            ) : null}

            <PaymentFilters
                values={filters}
                contracts={contractOptions}
                sort={sort}
                activeCount={activeFilters}
            />

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            {/* Seven columns do not fit a phone, so small screens get cards and
                the table takes over from lg up (NFR-12.1). */}
            <div className="flex flex-col gap-3 lg:hidden">
                {page.data.length === 0 ? (
                    <Card className="px-4 py-14">
                        <EmptyState filtered={filtered} />
                    </Card>
                ) : (
                    page.data.map((payment) => {
                        const voided = payment.voided_at !== null;

                        return (
                            <Card
                                key={payment.id}
                                className={`p-4 ${voided ? "opacity-70" : ""}`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-muted">
                                        <Icon
                                            name="creditCard"
                                            className="size-4"
                                        />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={`truncate font-medium text-foreground ${
                                                voided ? "line-through" : ""
                                            }`}
                                        >
                                            {payment.customer_name}
                                        </p>
                                        <p className="truncate text-xs text-muted">
                                            {payment.product_name}
                                        </p>
                                    </div>
                                    <span
                                        className={`shrink-0 text-base font-semibold tabular-nums ${
                                            voided
                                                ? "text-muted line-through"
                                                : "text-foreground"
                                        }`}
                                    >
                                        {pkr(payment.amount)}
                                    </span>
                                </div>

                                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                                    <div className="min-w-0">
                                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                            Paid on
                                        </dt>
                                        <dd className="text-sm tabular-nums text-foreground">
                                            {formatDate(payment.payment_date)}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                            Method
                                        </dt>
                                        <dd className="text-sm text-foreground">
                                            {payment.method}
                                        </dd>
                                    </div>
                                </dl>

                                {voided ? (
                                    <p className="mt-3 rounded-md border border-negative/30 bg-negative/8 px-3 py-2 text-xs text-negative">
                                        <span className="font-medium">
                                            Voided
                                        </span>{" "}
                                        — {payment.void_reason}
                                    </p>
                                ) : null}

                                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                                    <Link
                                        href={`/contracts/${payment.contract_id}/invoice`}
                                        className="text-xs text-muted underline-offset-4 hover:underline"
                                    >
                                        Contract #{payment.contract_id}
                                    </Link>
                                    {voided ? null : (
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => setVoiding(payment)}
                                        >
                                            <Icon
                                                name="close"
                                                className="size-4"
                                            />
                                            Void
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>

            <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">Sr #</th>
                            <SortableHeader
                                field="customer"
                                label="Customer"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="product"
                                label="Product"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="amount"
                                label="Amount"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                            <SortableHeader
                                field="payment_date"
                                label="Paid on"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="method"
                                label="Method"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <th className="px-4 py-3 font-medium">Recorded by</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {page.data.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-14">
                                    <EmptyState filtered={filtered} />
                                </td>
                            </tr>
                        ) : (
                            page.data.map((payment, index) => {
                                const voided = payment.voided_at !== null;

                                return (
                                    <tr
                                        key={payment.id}
                                        className={`align-middle transition-colors hover:bg-surface-muted ${
                                            voided
                                                ? "text-muted"
                                                : "text-foreground"
                                        }`}
                                        // FR-PAY-09: the reason is on hover,
                                        // so a struck row explains itself.
                                        title={
                                            voided
                                                ? `Voided: ${payment.void_reason}`
                                                : undefined
                                        }
                                    >
                                        <td className="px-4 py-3 tabular-nums text-muted">
                                            {from + index}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/contracts/${payment.contract_id}/invoice`}
                                                className={`font-medium underline-offset-2 hover:underline ${
                                                    voided ? "line-through" : ""
                                                }`}
                                            >
                                                {payment.customer_name}
                                            </Link>
                                            <p className="text-xs tabular-nums text-muted">
                                                {payment.customer_cnic}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            {payment.product_name}
                                            {payment.note ? (
                                                <p className="truncate text-xs text-muted">
                                                    {payment.note}
                                                </p>
                                            ) : null}
                                        </td>
                                        <td
                                            className={`px-4 py-3 text-right font-medium tabular-nums ${
                                                voided ? "line-through" : ""
                                            }`}
                                        >
                                            {pkr(payment.amount)}
                                        </td>
                                        <td
                                            className="px-4 py-3 whitespace-nowrap tabular-nums"
                                            title={formatDateTime(
                                                payment.created_at
                                            )}
                                        >
                                            {formatDate(payment.payment_date)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {voided ? (
                                                <Badge tone="negative">
                                                    voided
                                                </Badge>
                                            ) : (
                                                payment.method
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted">
                                            {payment.recorded_by_name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-2">
                                                {voided ? (
                                                    <span className="text-xs text-muted">
                                                        —
                                                    </span>
                                                ) : (
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() =>
                                                            setVoiding(payment)
                                                        }
                                                        iconOnly
                                                        aria-label={`Void payment ${payment.id}`}
                                                        title="Void"
                                                    >
                                                        <Icon
                                                            name="close"
                                                            className="size-4"
                                                        />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </Card>

            {page.total > 0 ? (
                <nav className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-xs text-muted">
                        Showing {from}–{to} of {page.total}
                    </span>
                    {page.total_pages > 1 ? (
                        <div className="flex items-center gap-2">
                            {page.page > 1 ? (
                                <ButtonLink
                                    href={pageHref(page.page - 1)}
                                    variant="secondary"
                                    size="sm"
                                    iconOnly
                                    aria-label="Previous page"
                                    title="Previous page"
                                >
                                    <Icon name="chevronLeft" className="size-4" />
                                </ButtonLink>
                            ) : null}
                            <span className="text-xs text-muted">
                                Page {page.page} of {page.total_pages}
                            </span>
                            {page.page < page.total_pages ? (
                                <ButtonLink
                                    href={pageHref(page.page + 1)}
                                    variant="secondary"
                                    size="sm"
                                    iconOnly
                                    aria-label="Next page"
                                    title="Next page"
                                >
                                    <Icon name="chevronRight" className="size-4" />
                                </ButtonLink>
                            ) : null}
                        </div>
                    ) : null}
                </nav>
            ) : null}

            <Modal
                open={collecting}
                onClose={() => setCollecting(false)}
                title="Record payment"
                description="The balance and the next installment come from the contract itself."
            >
                {collecting ? (
                    <PaymentForm
                        contracts={collectable}
                        initialContractId={
                            filters.contract_id
                                ? Number(filters.contract_id)
                                : null
                        }
                        onSaved={handleSaved}
                        onCancel={() => setCollecting(false)}
                    />
                ) : null}
            </Modal>

            <VoidPaymentDialog
                payment={voiding}
                onClose={() => setVoiding(null)}
                onDone={handleVoided}
            />
        </PageContainer>
    );
}
