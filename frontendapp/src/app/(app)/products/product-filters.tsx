"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CARD_CLASS } from "@/components/ui/card";
import type { Category, ProductFilterValues, ProductSort } from "@/types/product";

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

type Props = {
    values: ProductFilterValues;
    /** Read from the lookup, so the dropdown can only offer real categories. */
    categories: Category[];
    activeCount: number;
    sort: ProductSort;
};

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-w-0">
            <span className={labelClass}>{label}</span>
            {children}
        </div>
    );
}

export function ProductFilters({
    values,
    categories,
    activeCount,
    sort,
}: Props) {
    // Opens by default when something is already filtered, so an active filter
    // is never hidden behind a collapsed panel (NFR-13.2).
    const [open, setOpen] = useState(activeCount > 0);

    return (
        <form action="/products" method="get" className={`mb-6 ${CARD_CLASS}`}>
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="relative sm:flex-1">
                    <Icon
                        name="search"
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                    />
                    <input
                        type="search"
                        name="search"
                        defaultValue={values.search}
                        placeholder="Search product name"
                        className={`${controlClass} pl-9`}
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => setOpen(!open)}
                        aria-expanded={open}
                        className="flex-1 sm:flex-none"
                    >
                        <Icon name="settings" className="size-4" />
                        Filters
                        {activeCount > 0 ? (
                            <Badge tone="solid">{activeCount}</Badge>
                        ) : null}
                    </Button>

                    <Button type="submit" className="flex-1 sm:flex-none">
                        Apply
                    </Button>
                </div>
            </div>

            {open ? (
                <div className="border-t border-border p-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Category">
                            <select
                                name="category_id"
                                defaultValue={values.category_id}
                                className={controlClass}
                            >
                                <option value="">All</option>
                                {categories.map((category) => (
                                    <option
                                        key={category.id}
                                        value={String(category.id)}
                                    >
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Status">
                            <select
                                name="status"
                                defaultValue={values.status}
                                className={controlClass}
                            >
                                <option value="">All</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </Field>

                        {/* The table has clickable headers, but the card view
                            on small screens has none — so sorting is offered
                            here too, and applying filters keeps it. */}
                        <Field label="Sort by">
                            <select
                                name="sort"
                                defaultValue={sort.field}
                                className={controlClass}
                            >
                                <option value="name">Product name</option>
                                <option value="category">Category</option>
                                <option value="status">Status</option>
                                <option value="created_at">Date added</option>
                            </select>
                        </Field>

                        <Field label="Order">
                            <select
                                name="dir"
                                defaultValue={sort.dir}
                                className={controlClass}
                            >
                                <option value="asc">Ascending</option>
                                <option value="desc">Descending</option>
                            </select>
                        </Field>
                    </div>

                    {activeCount > 0 ? (
                        <div className="mt-3 flex justify-end">
                            <Link
                                href="/products"
                                className="inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                            >
                                <Icon name="close" className="size-3.5" />
                                Clear all filters
                            </Link>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </form>
    );
}
