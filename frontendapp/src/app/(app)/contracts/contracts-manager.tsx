"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteContract } from "./actions";
import { CancelContractDialog } from "./cancel-contract-dialog";
import { ContractFilters } from "./contract-filters";
import { FlashAlert } from "@/components/flash-alert";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import {
    DEFAULT_SORT,
    type Contract,
    type ContractFilterValues,
    type ContractSort,
    type ContractStatus,
    type Paginated,
    type SortDirection,
    type SortField,
} from "@/types/contract";

type Option = { value: string; label: string };

type Props = {
    page: Paginated<Contract>;
    filters: ContractFilterValues;
    sort: ContractSort;
    customers: Option[];
    products: Option[];
    isAdmin: boolean;
    flash?: string;
    loadError: string | null;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** NFR-02: PKR, en-PK grouping, no decimals on screen. */
function pkr(value: string | null): string {
    if (value === null) return "—";

    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

function StatusBadge({
    status,
    write_off,
}: {
    status: ContractStatus;
    write_off: boolean;
}) {
    const tone =
        status === "active"
            ? "positive"
            : status === "completed"
              ? "solid"
              : "neutral";

    return (
        <span className="inline-flex items-center gap-1.5">
            <Badge tone={tone}>{status}</Badge>
            {/* A cancelled contract with money still owed is a different fact
                from a clean cancellation, and the register should say so. */}
            {write_off ? <Badge tone="negative">written off</Badge> : null}
        </span>
    );
}

function EmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="text-center">
            <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                <Icon name="fileText" className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
                {filtered
                    ? "No contracts match these filters"
                    : "No contracts yet"}
            </p>
            <p className="mt-1 text-xs text-muted">
                {filtered
                    ? "Try widening or clearing the filters."
                    : "Write the first contract to start a payment plan."}
            </p>
        </div>
    );
}

/**
 * Declared at module level: defining it inside the manager would recreate the
 * component on every render, which the React Compiler rejects.
 * Clicking the active column flips direction; a new column starts ascending.
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
    sort: ContractSort;
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

export default function ContractsManager({
    page,
    filters,
    sort,
    customers,
    products,
    isAdmin,
    flash,
    loadError,
}: Props) {
    const activeFilters = Object.values(filters).filter(Boolean).length;
    const filtered = activeFilters > 0;
    const { confirm, alert } = useAlert();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [cancelling, setCancelling] = useState<Contract | null>(null);
    const [, startTransition] = useTransition();

    async function handleDelete(contract: Contract) {
        const confirmed = await confirm({
            title: `Delete contract #${contract.id}?`,
            text: "It moves to the Recycle Bin and can be restored. A contract that has payments cannot be deleted at all — cancel it instead, which keeps the record and its history.",
            tone: "warning",
            confirmLabel: "Yes, delete it",
            destructive: true,
        });

        if (!confirmed) return;

        setDeletingId(contract.id);

        startTransition(async () => {
            const result = await deleteContract(contract.id);

            setDeletingId(null);

            void alert(
                result.ok
                    ? { title: result.message ?? "Deleted", tone: "success" }
                    : {
                          title: "Could not delete this contract",
                          text: result.message ?? undefined,
                          tone: "error",
                      }
            );
        });
    }

    function handleCancelled(message: string) {
        setCancelling(null);
        void alert({ title: message, tone: "success" });
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

        // The default (newest first) is the bare URL.
        if (field !== DEFAULT_SORT.field || dir !== DEFAULT_SORT.dir) {
            params.set("sort", field);
            params.set("dir", dir);
        }

        const target = overrides.page ?? page.page;
        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/contracts?${query}` : "/contracts";
    }

    function pageHref(target: number): string {
        return hrefWith({ page: target });
    }

    const sortHref = (field: SortField, dir: SortDirection) =>
        hrefWith({ sort: field, dir, page: 1 });

    const from = (page.page - 1) * page.page_size + 1;
    const to = Math.min(page.page * page.page_size, page.total);

    return (
        <PageContainer>
            <FlashAlert message={flash} cleanUrl={pageHref(page.page)} />

            <PageHeader
                eyebrow="Module 4"
                title="Contracts"
                description={
                    page.total === 0
                        ? "No records yet."
                        : `${page.total} contract${page.total === 1 ? "" : "s"}${
                              filtered ? " matching the filters" : ""
                          }`
                }
                actions={
                    <ButtonLink href="/contracts/new" stackOnMobile>
                        <Icon name="plus" className="size-4" />
                        New contract
                    </ButtonLink>
                }
            />

            <ContractFilters
                values={filters}
                customers={customers}
                products={products}
                sort={sort}
                activeCount={activeFilters}
            />

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            {/* Nine columns do not fit a phone, so small screens get cards and
                the table takes over from lg up (NFR-12.1). */}
            <div className="flex flex-col gap-3 lg:hidden">
                {page.data.length === 0 ? (
                    <Card className="px-4 py-14">
                        <EmptyState filtered={filtered} />
                    </Card>
                ) : (
                    page.data.map((contract) => (
                        <Card key={contract.id} className="p-4">
                            <div className="flex items-start gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-muted">
                                    <Icon name="fileText" className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/contracts/${contract.id}/edit`}
                                        className="block max-w-full truncate font-medium text-foreground underline-offset-2 hover:underline"
                                    >
                                        {contract.customer_name}
                                    </Link>
                                    <p className="truncate text-xs text-muted">
                                        {contract.product_name}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                                    #{contract.id}
                                </span>
                            </div>

                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Monthly
                                    </dt>
                                    <dd className="text-sm tabular-nums text-foreground">
                                        {pkr(contract.monthly_installment)}
                                        <span className="text-muted">
                                            {" "}
                                            × {contract.plan_months}
                                        </span>
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Financed
                                    </dt>
                                    <dd className="text-sm tabular-nums text-foreground">
                                        {pkr(contract.financed_amount)}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Term
                                    </dt>
                                    <dd className="text-sm tabular-nums text-foreground">
                                        {formatDate(contract.start_date)} –{" "}
                                        {formatDate(contract.end_date)}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Status
                                    </dt>
                                    <dd className="mt-1">
                                        <StatusBadge
                                            status={contract.status}
                                            write_off={contract.write_off}
                                        />
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                                <ButtonLink
                                    href={`/contracts/${contract.id}/edit`}
                                    variant="secondary"
                                    size="sm"
                                    iconOnly
                                    aria-label={`Edit contract ${contract.id}`}
                                    title="Edit"
                                >
                                    <Icon name="pencil" className="size-4" />
                                </ButtonLink>
                                {isAdmin && contract.status === "active" ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setCancelling(contract)}
                                        iconOnly
                                        aria-label={`Cancel contract ${contract.id}`}
                                        title="Cancel"
                                    >
                                        <Icon name="close" className="size-4" />
                                    </Button>
                                ) : null}
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDelete(contract)}
                                    disabled={deletingId === contract.id}
                                    iconOnly
                                    aria-label={`Delete contract ${contract.id}`}
                                    title={
                                        deletingId === contract.id
                                            ? "Deleting…"
                                            : "Delete"
                                    }
                                >
                                    <Icon name="trash" className="size-4" />
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
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
                                field="sale_price"
                                label="Price"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                            <SortableHeader
                                field="financed_amount"
                                label="Financed"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                            <th className="px-4 py-3 text-right font-medium">
                                Monthly
                            </th>
                            <SortableHeader
                                field="start_date"
                                label="Start"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="end_date"
                                label="End"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="status"
                                label="Status"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <th className="px-4 py-3 text-right font-medium">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {page.data.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-14">
                                    <EmptyState filtered={filtered} />
                                </td>
                            </tr>
                        ) : (
                            page.data.map((contract, index) => (
                                <tr
                                    key={contract.id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="px-4 py-3 tabular-nums text-muted">
                                        {from + index}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/contracts/${contract.id}/edit`}
                                            className="font-medium underline-offset-2 hover:underline"
                                        >
                                            {contract.customer_name}
                                        </Link>
                                        <p className="text-xs tabular-nums text-muted">
                                            {contract.customer_cnic}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {contract.product_name}
                                        <p className="text-xs text-muted">
                                            {contract.product_condition}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(contract.sale_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(contract.financed_amount)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(contract.monthly_installment)}
                                        <span className="text-xs text-muted">
                                            {" "}
                                            × {contract.plan_months}
                                        </span>
                                    </td>
                                    <td
                                        className="px-4 py-3 whitespace-nowrap tabular-nums"
                                        title={formatDateTime(
                                            contract.created_at
                                        )}
                                    >
                                        {formatDate(contract.start_date)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                        {formatDate(contract.end_date)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge
                                            status={contract.status}
                                            write_off={contract.write_off}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <ButtonLink
                                                href={`/contracts/${contract.id}/edit`}
                                                variant="secondary"
                                                size="sm"
                                                iconOnly
                                                aria-label={`Edit contract ${contract.id}`}
                                                title="Edit"
                                            >
                                                <Icon
                                                    name="pencil"
                                                    className="size-4"
                                                />
                                            </ButtonLink>
                                            {isAdmin &&
                                            contract.status === "active" ? (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() =>
                                                        setCancelling(contract)
                                                    }
                                                    iconOnly
                                                    aria-label={`Cancel contract ${contract.id}`}
                                                    title="Cancel"
                                                >
                                                    <Icon
                                                        name="close"
                                                        className="size-4"
                                                    />
                                                </Button>
                                            ) : null}
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() =>
                                                    handleDelete(contract)
                                                }
                                                disabled={
                                                    deletingId === contract.id
                                                }
                                                iconOnly
                                                aria-label={`Delete contract ${contract.id}`}
                                                title={
                                                    deletingId === contract.id
                                                        ? "Deleting…"
                                                        : "Delete"
                                                }
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

            <CancelContractDialog
                contract={cancelling}
                onClose={() => setCancelling(null)}
                onDone={handleCancelled}
            />
        </PageContainer>
    );
}
