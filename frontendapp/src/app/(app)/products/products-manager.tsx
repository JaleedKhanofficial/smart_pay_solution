"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteProduct } from "./actions";
import { ProductFilters } from "./product-filters";
import { ProductForm } from "./product-form";
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
import type {
    Category,
    Paginated,
    Product,
    ProductFilterValues,
    ProductSort,
    SortDirection,
    SortField,
} from "@/types/product";

type Props = {
    page: Paginated<Product>;
    filters: ProductFilterValues;
    sort: ProductSort;
    categories: Category[];
    flash?: string;
    loadError: string | null;
};

/** FR-PRD-05: only an Active product can be put on a contract. */
function StatusBadge({ status }: { status: Product["status"] }) {
    return (
        <Badge tone={status === "Active" ? "positive" : "neutral"}>
            {status}
        </Badge>
    );
}

function EmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="text-center">
            <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                <Icon name="box" className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
                {filtered
                    ? "No products match these filters"
                    : "No products yet"}
            </p>
            <p className="mt-1 text-xs text-muted">
                {filtered
                    ? "Try widening or clearing the filters."
                    : "Add your first product to start writing contracts."}
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
    sort: ProductSort;
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

export default function ProductsManager({
    page,
    filters,
    sort,
    categories,
    flash,
    loadError,
}: Props) {
    const activeFilters = Object.values(filters).filter(Boolean).length;
    const filtered = activeFilters > 0;
    const { confirm, alert } = useAlert();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [, startTransition] = useTransition();

    /**
     * `null` means closed; a product means edit; "new" means add. The catalogue
     * has no add/edit pages: editing in place keeps the register — its filters,
     * sort and page — on screen, which is the point.
     */
    const [editing, setEditing] = useState<Product | "new" | null>(null);

    function closeEditor() {
        setEditing(null);
    }

    function handleSaved(message: string) {
        setEditing(null);
        void alert({ title: message, tone: "success" });
    }

    async function handleDelete(product: Product) {
        const confirmed = await confirm({
            title: `Delete ${product.name}?`,
            text: "The record moves to the Recycle Bin and can be restored later. To keep it out of new contracts without deleting it, set the status to Inactive instead.",
            tone: "warning",
            confirmLabel: "Yes, delete it",
            destructive: true,
        });

        if (!confirmed) return;

        setDeletingId(product.id);

        startTransition(async () => {
            const result = await deleteProduct(product.id);

            setDeletingId(null);

            void alert(
                result.ok
                    ? { title: result.message ?? "Deleted", tone: "success" }
                    : {
                          title: "Could not delete this product",
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

        // The default (name ascending) is the bare URL.
        if (field !== "name" || dir !== "asc") {
            params.set("sort", field);
            params.set("dir", dir);
        }

        const target = overrides.page ?? page.page;
        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/products?${query}` : "/products";
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
                eyebrow="Module 3"
                title="Products"
                description={
                    page.total === 0
                        ? "No records yet."
                        : `${page.total} product${page.total === 1 ? "" : "s"}${
                              filtered ? " matching the filters" : ""
                          }`
                }
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <ButtonLink
                            href="/products/categories"
                            variant="secondary"
                            stackOnMobile
                        >
                            <Icon name="settings" className="size-4" />
                            Categories
                        </ButtonLink>
                        <Button onClick={() => setEditing("new")} stackOnMobile>
                            <Icon name="plus" className="size-4" />
                            Add product
                        </Button>
                    </div>
                }
            />

            <ProductFilters
                values={filters}
                categories={categories}
                sort={sort}
                activeCount={activeFilters}
            />

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            {/* Six columns do not fit a phone, so small screens get cards and
                the table takes over from lg up (NFR-12.1). */}
            <div className="flex flex-col gap-3 lg:hidden">
                {page.data.length === 0 ? (
                    <Card className="px-4 py-14">
                        <EmptyState filtered={filtered} />
                    </Card>
                ) : (
                    page.data.map((product) => (
                        <Card key={product.id} className="p-4">
                            <div className="flex items-start gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-muted">
                                    <Icon name="box" className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => setEditing(product)}
                                        className="block max-w-full truncate text-left font-medium text-foreground underline-offset-2 hover:underline"
                                    >
                                        {product.name}
                                    </button>
                                    <p className="truncate text-xs text-muted">
                                        {product.category_name}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                                    #{product.id}
                                </span>
                            </div>

                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Status
                                    </dt>
                                    <dd className="mt-1">
                                        <StatusBadge status={product.status} />
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                                        Created At
                                    </dt>
                                    <dd
                                        className="text-sm tabular-nums text-foreground"
                                        title={formatDateTime(product.created_at)}
                                    >
                                        {formatDate(product.created_at)}
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setEditing(product)}
                                    iconOnly
                                    aria-label={`Edit ${product.name}`}
                                    title="Edit"
                                >
                                    <Icon name="pencil" className="size-4" />
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDelete(product)}
                                    disabled={deletingId === product.id}
                                    iconOnly
                                    aria-label={`Delete ${product.name}`}
                                    title={
                                        deletingId === product.id
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
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">Sr #</th>
                            <SortableHeader
                                field="name"
                                label="Product"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="category"
                                label="Category"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="status"
                                label="Status"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="created_at"
                                label="Created At"
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
                                <td colSpan={6} className="px-4 py-14">
                                    <EmptyState filtered={filtered} />
                                </td>
                            </tr>
                        ) : (
                            page.data.map((product, index) => (
                                <tr
                                    key={product.id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="px-4 py-3 tabular-nums text-muted">
                                        {from + index}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(product)}
                                            className="text-left font-medium underline-offset-2 hover:underline"
                                        >
                                            {product.name}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        {product.category_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={product.status} />
                                    </td>
                                    <td
                                        className="px-4 py-3 whitespace-nowrap tabular-nums"
                                        title={formatDateTime(product.created_at)}
                                    >
                                        {formatDate(product.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() =>
                                                    setEditing(product)
                                                }
                                                iconOnly
                                                aria-label={`Edit ${product.name}`}
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
                                                onClick={() =>
                                                    handleDelete(product)
                                                }
                                                disabled={
                                                    deletingId === product.id
                                                }
                                                iconOnly
                                                aria-label={`Delete ${product.name}`}
                                                title={
                                                    deletingId === product.id
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

            <Modal
                open={editing !== null}
                onClose={closeEditor}
                title={
                    editing === null || editing === "new"
                        ? "Add product"
                        : `Edit ${editing.name}`
                }
                description={
                    editing === null || editing === "new"
                        ? "It appears on the contract picker while its status is Active."
                        : `Product #${editing.id}`
                }
            >
                {editing !== null ? (
                    <ProductForm
                        /* Remounts per record, so the fields re-seed when the
                           panel is reopened on a different row. */
                        key={editing === "new" ? "new" : editing.id}
                        product={editing === "new" ? null : editing}
                        categories={categories}
                        onSaved={handleSaved}
                        onCancel={closeEditor}
                    />
                ) : null}
            </Modal>
        </PageContainer>
    );
}
