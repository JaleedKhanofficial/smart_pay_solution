"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { deleteCustomer } from "./actions";
import { CustomerFilters } from "./customer-filters";
import { FlashAlert } from "@/components/flash-alert";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
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

function Thumbnail({
    fileId,
    alt,
    emptyLabel = "No CNIC image",
}: {
    fileId: string | null;
    alt: string;
    /** Named so a missing front and a missing back are distinguishable. */
    emptyLabel?: string;
}) {
    if (!fileId) {
        return (
            <span
                title={emptyLabel}
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

/**
 * Both sides of the customer's own CNIC, rendered the same way the guarantor
 * scans are. A missing side still occupies its slot, so front and back stay in
 * the same position on every row and the pair is scannable down the column.
 */
function CustomerCnicThumbs({ customer }: { customer: Customer }) {
    return (
        <>
            <Thumbnail
                fileId={customer.cnic_file_front_id}
                alt={`CNIC front of ${customer.full_name}`}
                emptyLabel="No CNIC front image"
            />
            <Thumbnail
                fileId={customer.cnic_file_back_id}
                alt={`CNIC back of ${customer.full_name}`}
                emptyLabel="No CNIC back image"
            />
        </>
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
                <Fragment key={guarantor.id}>
                    <Thumbnail
                        fileId={guarantor.cnic_file_front_id}
                        alt={`CNIC front of ${guarantor.full_name}`}
                        emptyLabel={`No CNIC front image for ${guarantor.full_name}`}
                    />
                    <Thumbnail
                        fileId={guarantor.cnic_file_back_id}
                        alt={`CNIC back of ${guarantor.full_name}`}
                        emptyLabel={`No CNIC back image for ${guarantor.full_name}`}
                    />
                </Fragment>
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
    const { confirm, alert } = useAlert();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [, startTransition] = useTransition();

    async function handleDelete(customer: Customer) {
        const confirmed = await confirm({
            title: `Delete ${customer.full_name}?`,
            text: "The record moves to the Recycle Bin and can be restored later.",
            tone: "warning",
            confirmLabel: "Yes, delete it",
            destructive: true,
        });

        if (!confirmed) return;

        setDeletingId(customer.id);

        startTransition(async () => {
            const result = await deleteCustomer(customer.id);

            setDeletingId(null);

            void alert(
                result.ok
                    ? { title: result.message ?? "Deleted", tone: "success" }
                    : {
                          title: "Could not delete this customer",
                          text: result.message ?? undefined,
                          tone: "error",
                      }
            );
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

        if (field !== "created_at" || dir !== "desc") {
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

    const from = (page.page - 1) * page.page_size + 1;
    const to = Math.min(page.page * page.page_size, page.total);

    return (
        <PageContainer>
            <FlashAlert message={flash} cleanUrl={pageHref(page.page)} />

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
                    <ButtonLink href="/customers/new" stackOnMobile>
                        <Icon name="plus" className="size-4" />
                        Add customer
                    </ButtonLink>
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
                    <Card className="px-4 py-14">
                        <EmptyState filtered={filtered} />
                    </Card>
                ) : (
                    page.data.map((customer) => (
                        <Card key={customer.id} className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="flex shrink-0 gap-1">
                                    <CustomerCnicThumbs customer={customer} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/customers/${customer.id}/edit`}
                                        className="block truncate font-medium text-foreground underline-offset-2 hover:underline"
                                    >
                                        {customer.full_name}
                                    </Link>
                                    <p className="truncate text-xs text-muted">
                                        s/o {customer.father_husband_name}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                                    #{customer.id}
                                </span>
                            </div>

                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="col-span-2">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        CNIC
                                    </dt>
                                    <dd className="font-mono text-xs text-foreground">
                                        {customer.cnic_number}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Mobile No
                                    </dt>
                                    <dd className="text-sm">
                                        <a
                                            href={`tel:${customer.mobile_number.replace(/\D/g, "")}`}
                                            className="text-foreground underline-offset-2 hover:underline"
                                        >
                                            {customer.mobile_number}
                                        </a>
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Occupation
                                    </dt>
                                    <dd className="truncate text-sm text-foreground">
                                        {customer.occupation}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Created At
                                    </dt>
                                    <dd
                                        className="text-sm tabular-nums text-foreground"
                                        title={formatDateTime(customer.created_at)}
                                    >
                                        {formatDate(customer.created_at)}
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                                <div className="flex items-center gap-1">
                                    <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">
                                        Guarantors
                                    </span>
                                    <GuarantorThumbs customer={customer} />
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    <ButtonLink
                                        href={`/customers/${customer.id}/edit`}
                                        variant="secondary"
                                        size="sm"
                                        iconOnly
                                        aria-label={`Edit ${customer.full_name}`}
                                        title="Edit"
                                    >
                                        <Icon name="pencil" className="size-4" />
                                    </ButtonLink>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleDelete(customer)}
                                        disabled={deletingId === customer.id}
                                        iconOnly
                                        aria-label={`Delete ${customer.full_name}`}
                                        title={
                                            deletingId === customer.id
                                                ? "Deleting…"
                                                : "Delete"
                                        }
                                    >
                                        <Icon name="trash" className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">Sr #</th>
                            <th className="hidden px-4 py-3 font-medium xl:table-cell">
                                CNIC images
                            </th>
                            <SortableHeader
                                field="full_name"
                                label="Name"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="cnic_number"
                                label="CNIC"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="mobile_number"
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
                            <SortableHeader
                                field="created_at"
                                label="Created At"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <th className="px-4 py-3 font-medium">Guarantors</th>
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
                            page.data.map((customer, index) => (
                                <tr
                                    key={customer.id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="px-4 py-3 tabular-nums text-muted">
                                        {from + index}
                                    </td>
                                    <td className="hidden px-4 py-3 xl:table-cell">
                                        <div className="flex items-center gap-1">
                                            <CustomerCnicThumbs
                                                customer={customer}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/customers/${customer.id}/edit`}
                                            className="font-medium underline-offset-2 hover:underline"
                                        >
                                            {customer.full_name}
                                        </Link>
                                        <div className="text-xs text-muted">
                                            s/o {customer.father_husband_name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {customer.cnic_number}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {customer.mobile_number}
                                    </td>
                                    <td className="px-4 py-3">
                                        {customer.occupation}
                                    </td>
                                    <td
                                        className="px-4 py-3 whitespace-nowrap tabular-nums"
                                        // title={formatDateTime(customer.created_at)}
                                    >
                                        {formatDate(customer.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <GuarantorThumbs
                                                customer={customer}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <ButtonLink
                                                href={`/customers/${customer.id}/edit`}
                                                variant="secondary"
                                                size="sm"
                                                iconOnly
                                                aria-label={`Edit ${customer.full_name}`}
                                                title="Edit"
                                            >
                                                <Icon
                                                    name="pencil"
                                                    className="size-4"
                                                />
                                            </ButtonLink>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() =>
                                                    handleDelete(customer)
                                                }
                                                disabled={
                                                    deletingId === customer.id
                                                }
                                                iconOnly
                                                aria-label={`Delete ${customer.full_name}`}
                                                title={
                                                    deletingId === customer.id
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
        </PageContainer>
    );
}
