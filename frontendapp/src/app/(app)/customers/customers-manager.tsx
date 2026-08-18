"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteCustomer } from "./actions";
import { FlashToast } from "@/components/flash-toast";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import type { Customer, Paginated } from "@/types/customer";

type Props = {
    page: Paginated<Customer>;
    search: string;
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

export default function CustomersManager({
    page,
    search,
    flash,
    loadError,
}: Props) {
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

    function pageHref(target: number): string {
        const params = new URLSearchParams();

        if (search) params.set("search", search);
        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/customers?${query}` : "/customers";
    }

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
                              search ? ` matching “${search}”` : ""
                          }`
                }
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <form
                            action="/customers"
                            method="get"
                            className="flex gap-2"
                        >
                            <input
                                type="search"
                                name="search"
                                defaultValue={search}
                                placeholder="Name, CNIC or mobile"
                                className="w-56 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-navy-600"
                            />
                            <button
                                type="submit"
                                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                            >
                                Search
                            </button>
                            {search ? (
                                <Link
                                    href="/customers"
                                    className="rounded-md px-2 py-2 text-sm text-muted underline-offset-4 hover:underline"
                                >
                                    Clear
                                </Link>
                            ) : null}
                        </form>

                        <Link
                            href="/customers/new"
                            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700"
                        >
                            Add customer
                        </Link>
                    </div>
                }
            />

            {loadError ? (
                <p className="mb-6 rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-[11px] uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">CNIC image</th>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">CNIC</th>
                            <th className="px-4 py-3 font-medium">Mobile</th>
                            <th className="px-4 py-3 font-medium">Occupation</th>
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
                                <td colSpan={8} className="px-4 py-14">
                                    <div className="text-center">
                                        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                                            <Icon
                                                name="users"
                                                className="size-5"
                                            />
                                        </span>
                                        <p className="text-sm font-medium text-foreground">
                                            {search
                                                ? "No customers match that search"
                                                : "No customers yet"}
                                        </p>
                                        <p className="mt-1 text-xs text-muted">
                                            {search
                                                ? "Try a different name, CNIC or mobile."
                                                : "Add your first customer to get started."}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            page.data.map((customer) => (
                                <tr
                                    key={customer.id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="px-4 py-3">
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
                                            {customer.guarantors.map(
                                                (guarantor) => (
                                                    <Thumbnail
                                                        key={guarantor.id}
                                                        fileId={
                                                            guarantor.cnicFileId
                                                        }
                                                        alt={`CNIC of ${guarantor.fullName}`}
                                                    />
                                                )
                                            )}
                                            {customer.guarantors.length === 0 ? (
                                                <span
                                                    title="No guarantor on record"
                                                    className="text-negative"
                                                >
                                                    <Icon
                                                        name="alert"
                                                        className="size-4"
                                                    />
                                                </span>
                                            ) : null}
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
