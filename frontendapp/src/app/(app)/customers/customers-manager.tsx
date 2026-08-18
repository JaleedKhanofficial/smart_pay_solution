"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteCustomer } from "./actions";
import { CustomerFilters } from "./customer-filters";
import { FlashToast } from "@/components/flash-toast";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import type {
    Customer,
    CustomerFilterValues,
    CustomerSort,
    Paginated,
    SortDirection,
    SortField,
} from "@/types/customer";

type Props = {
    page: Paginated<Customer>;
    filters: CustomerFilterValues;
    sort: CustomerSort;
    occupations: string[];
    flash?: string;
    loadError: string | null;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** NFR-02: PKR, en-PK grouping, no decimals. */
function formatPkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

function Thumbnail({ fileId, alt }: { fileId: string | null; alt: string }) {
    if (!fileId) {
        return (
            <span
                title="No CNIC image"
                className="grid size-9 place-items-center rounded-md border border-dashed border-border text-muted"
            >
                <Icon name="fileText" className="size-4" />
            </span>
        );
    }

    return (
        // Plain <img>: the optimiser would fetch /media without the session
        // cookie and get a 401.
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={`/media/${encodeURIComponent(fileId)}`}
            alt={alt}
            className="size-9 rounded-md border border-border object-cover"
        />
    );
}

function EmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="text-center">
            <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                <Icon name="users" className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
                {filtered
                    ? "No customers match these filters"
                    : "No customers yet"}
            </p>
            <p className="mt-1 text-xs text-muted">
                {filtered
                    ? "Try widening or clearing the filters."
                    : "Add your first customer to get started."}
            </p>
        </div>
    );
}

function GuarantorThumbs({ customer }: { customer: Customer }) {
    if (customer.guarantors.length === 0) {
        return (
            <span title="No guarantor on record" className="text-negative">
                <Icon name="alert" className="size-4" />
            </span>
        );
    }

    return (
        <>
            {customer.guarantors.map((guarantor) => (
                <Thumbnail
                    key={guarantor.id}
                    fileId={guarantor.cnicFileId}
                    alt={`CNIC of ${guarantor.fullName}`}
                />
            ))}
        </>
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
}: {
    field: SortField;
    label: string;
    sort: CustomerSort;
    hrefFor: (field: SortField, dir: SortDirection) => string;
}) {
    const active = sort.field === field;
    const nextDir: SortDirection = active && sort.dir === "asc" ? "desc" : "asc";

    return (
        <th
            className="px-4 py-3 font-medium"
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
                <span
                    aria-hidden="true"
                    className={active ? "text-gold" : "text-muted/40"}
                >
                    {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
                </span>
            </Link>
        </th>
    );
}

export default function CustomersManager({
    page,
    filters,
    sort,
    occupations,
    flash,
    loadError,
}: Props) {
    const activeFilters = Object.values(filters).filter(Boolean).length;
    const filtered = activeFilters > 0;
    const { push } = useToast();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [, startTransition] = useTransition();

    function handleDelete(customer: Customer) {
        if (
            !window.confirm(
                `Delete ${customer.fullName}? This can be undone from the Recycle Bin.`
            )
        ) {
            return;
        }

        setDeletingId(customer.id);

        startTransition(async () => {
            const result = await deleteCustomer(customer.id);

            setDeletingId(null);
            push(result.message ?? "Done.", result.ok ? "success" : "error");
        });
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

        if (field !== "createdAt" || dir !== "desc") {
            params.set("sort", field);
            params.set("dir", dir);
        }

        const target = overrides.page ?? page.page;
        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/customers?${query}` : "/customers";
    }

    function pageHref(target: number): string {
        return hrefWith({ page: target });
    }

    const sortHref = (field: SortField, dir: SortDirection) =>
        hrefWith({ sort: field, dir, page: 1 });

    const from = (page.page - 1) * page.pageSize + 1;
    const to = Math.min(page.page * page.pageSize, page.total);

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <FlashToast message={flash} cleanUrl={pageHref(page.page)} />

            <PageHeader
                eyebrow="Module 2"
                title="Customers"
                description={
                    page.total === 0
                        ? "No records yet."
                        : `${page.total} record${page.total === 1 ? "" : "s"}${
                              filtered ? " matching the filters" : ""
                          }`
                }
                actions={
                    <Link
                        href="/customers/new"
                        className="w-full rounded-md bg-navy-800 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-navy-700 sm:w-auto sm:py-2"
                    >
                        Add customer
                    </Link>
                }
            />

            <CustomerFilters
                values={filters}
                occupations={occupations}
                activeCount={activeFilters}
                sort={sort}
            />

            {loadError ? (
                <p className="mb-6 rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            {/* Seven columns do not fit a phone, so small screens get cards
                and the table takes over from lg up. */}
            <div className="flex flex-col gap-3 lg:hidden">
                {page.data.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface px-4 py-14">
                        <EmptyState filtered={filtered} />
                    </div>
                ) : (
                    page.data.map((customer) => (
                        <article
                            key={customer.id}
                            className="rounded-xl border border-border bg-surface p-4"
                        >
                            <div className="flex items-start gap-3">
                                <Thumbnail
                                    fileId={customer.cnicFileId}
                                    alt={`CNIC of ${customer.fullName}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/customers/${customer.id}/edit`}
                                        className="block truncate font-medium text-foreground underline-offset-2 hover:underline"
                                    >
                                        {customer.fullName}
                                    </Link>
                                    <p className="truncate text-xs text-muted">
                                        s/o {customer.fatherHusbandName}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                                    #{customer.id}
                                </span>
                            </div>

                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="col-span-2">
                                    <dt className="text-[11px] uppercase tracking-wide text-muted">
                                        CNIC
                                    </dt>
                                    <dd className="font-mono text-xs text-foreground">
                                        {customer.cnicNumber}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-[11px] uppercase tracking-wide text-muted">
                                        Mobile
                                    </dt>
                                    <dd className="text-sm">
                                        <a
                                            href={`tel:${customer.mobileNumber.replace(/\D/g, "")}`}
                                            className="text-foreground underline-offset-2 hover:underline"
                                        >
                                            {customer.mobileNumber}
                                        </a>
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-[11px] uppercase tracking-wide text-muted">
                                        Occupation
                                    </dt>
                                    <dd className="truncate text-sm text-foreground">
                                        {customer.occupation}
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                                <div className="flex items-center gap-1">
                                    <span className="mr-1 text-[11px] uppercase tracking-wide text-muted">
                                        Guarantors
                                    </span>
                                    <GuarantorThumbs customer={customer} />
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    <Link
                                        href={`/customers/${customer.id}/edit`}
                                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(customer)}
                                        disabled={deletingId === customer.id}
                                        className="rounded-md border border-negative/40 px-3 py-1.5 text-xs font-medium text-negative transition-colors hover:bg-negative/8 disabled:opacity-60"
                                    >
                                        {deletingId === customer.id
                                            ? "Deleting…"
                                            : "Delete"}
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))
                )}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface lg:block">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-[11px] uppercase tracking-wide text-muted">
                        <tr>
                            <th className="hidden px-4 py-3 font-medium xl:table-cell">
                                CNIC image
                            </th>
                            <SortableHeader
                                field="fullName"
                                label="Name"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="cnicNumber"
                                label="CNIC"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="mobileNumber"
                                label="Mobile"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="occupation"
                                label="Occupation"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            {/* <th className="px-4 py-3 font-medium">Income</th> */}
                            <th className="px-4 py-3 font-medium">Guarantors</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {page.data.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-14">
                                    <EmptyState filtered={filtered} />
                                </td>
                            </tr>
                        ) : (
                            page.data.map((customer) => (
                                <tr
                                    key={customer.id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="hidden px-4 py-3 xl:table-cell">
                                        <Thumbnail
                                            fileId={customer.cnicFileId}
                                            alt={`CNIC of ${customer.fullName}`}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/customers/${customer.id}/edit`}
                                            className="font-medium underline-offset-2 hover:underline"
                                        >
                                            {customer.fullName}
                                        </Link>
                                        <div className="text-xs text-muted">
                                            s/o {customer.fatherHusbandName}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {customer.cnicNumber}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {customer.mobileNumber}
                                    </td>
                                    <td className="px-4 py-3">
                                        {customer.occupation}
                                    </td>
                                    {/* <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                        {formatPkr(customer.monthlyIncome)}
                                    </td> */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <GuarantorThumbs
                                                customer={customer}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/customers/${customer.id}/edit`}
                                                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background"
                                            >
                                                Edit
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDelete(customer)
                                                }
                                                disabled={
                                                    deletingId === customer.id
                                                }
                                                className="rounded-md border border-negative/40 px-3 py-1.5 text-xs font-medium text-negative transition-colors hover:bg-negative/8 disabled:opacity-60"
                                            >
                                                {deletingId === customer.id
                                                    ? "Deleting…"
                                                    : "Delete"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {page.total > 0 ? (
                <nav className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-xs text-muted">
                        Showing {from}–{to} of {page.total}
                    </span>
                    {page.totalPages > 1 ? (
                        <div className="flex items-center gap-2">
                            {page.page > 1 ? (
                                <Link
                                    href={pageHref(page.page - 1)}
                                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                                >
                                    Previous
                                </Link>
                            ) : null}
                            <span className="text-xs text-muted">
                                Page {page.page} of {page.totalPages}
                            </span>
                            {page.page < page.totalPages ? (
                                <Link
                                    href={pageHref(page.page + 1)}
                                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                                >
                                    Next
                                </Link>
                            ) : null}
                        </div>
                    ) : null}
                </nav>
            ) : null}
        </div>
    );
}
