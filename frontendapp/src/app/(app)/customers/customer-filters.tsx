"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CARD_CLASS } from "@/components/ui/card";
import type { CustomerFilterValues, CustomerSort } from "@/types/customer";

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

type Props = {
    values: CustomerFilterValues;
    /** Distinct occupations already in the register. */
    occupations: string[];
    activeCount: number;
    sort: CustomerSort;
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

export function CustomerFilters({
    values,
    occupations,
    activeCount,
    sort,
}: Props) {
    // Opens by default when something is already filtered, so an active filter
    // is never hidden behind a collapsed panel.
    const [open, setOpen] = useState(activeCount > 0);

    return (
        <form
            action="/customers"
            method="get"
            className={`mb-6 ${CARD_CLASS}`}
        >
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
                        placeholder="Search name, CNIC or mobile"
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
                        <Field label="Occupation">
                            <select
                                name="occupation"
                                defaultValue={values.occupation}
                                className={controlClass}
                            >
                                <option value="">All</option>
                                {occupations.map((occupation) => (
                                    <option key={occupation} value={occupation}>
                                        {occupation}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Guarantors">
                            <select
                                name="guarantors"
                                defaultValue={values.guarantors}
                                className={controlClass}
                            >
                                <option value="">All</option>
                                <option value="two">Both on file</option>
                                <option value="one">Only one</option>
                                <option value="none">None</option>
                            </select>
                        </Field>

                        <Field label="CNIC image">
                            <select
                                name="cnicImage"
                                defaultValue={values.cnicImage}
                                className={controlClass}
                            >
                                <option value="">All</option>
                                <option value="with">Uploaded</option>
                                <option value="without">Missing</option>
                            </select>
                        </Field>

                        {/* Each half of a range gets its own grid cell. Pairing
                            them side by side would overflow a 320px screen:
                            a native date input will not shrink below roughly
                            140px, and two of them plus a separator cannot fit
                            (NFR-12.2). */}
                        <Field label="Added from">
                            <input
                                type="date"
                                name="addedFrom"
                                defaultValue={values.addedFrom}
                                className={controlClass}
                            />
                        </Field>

                        <Field label="Added to">
                            <input
                                type="date"
                                name="addedTo"
                                defaultValue={values.addedTo}
                                className={controlClass}
                            />
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
                                <option value="createdAt">Date added</option>
                                <option value="fullName">Name</option>
                                <option value="cnicNumber">CNIC</option>
                                <option value="mobileNumber">Mobile</option>
                                <option value="occupation">Occupation</option>
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
                                href="/customers"
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
