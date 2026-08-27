"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CARD_CLASS, Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
    type AuditEntry,
    type AuditFacets,
    type AuditFilterValues,
    type Paginated,
} from "@/types/audit";

type Props = {
    page: Paginated<AuditEntry>;
    filters: AuditFilterValues;
    facets: AuditFacets;
    loadError: string | null;
};

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

/**
 * Actions are open-ended — the filter list comes from whatever the log holds —
 * so this maps the ones worth colouring and leaves the rest neutral rather
 * than pretending to know every action that will ever exist.
 */
function actionTone(action: string): BadgeTone {
    if (action === "create") return "positive";
    if (/delete|void|cancel|purge|locked_out|failed|reuse/.test(action)) {
        return "negative";
    }
    if (action.startsWith("login") || action === "logout") return "neutral";

    return "accent";
}

/** Values in a diff are arbitrary JSON; render them readably and briefly. */
function show(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return value === "" ? "(empty)" : value;
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    return JSON.stringify(value);
}

/**
 * Where a record's own screen lives, when it has one. Entities with no detail
 * screen — a payment, a setting — render their id as plain text rather than a
 * link that goes somewhere unhelpful.
 */
function recordHref(entity: string, id: string | null): string | null {
    if (!id) return null;

    if (entity === "contract") return `/contracts/${id}/ledger`;
    if (entity === "customer") return `/customers/${id}/edit`;

    return null;
}

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

function Row({ entry }: { entry: AuditEntry }) {
    const [open, setOpen] = useState(false);

    const snapshot = entry.after ?? entry.before;
    const href = recordHref(entry.entity, entry.entity_id);

    // A create or delete has one snapshot and no diff; an update has a diff and
    // the snapshots behind it. Either way there is something worth expanding.
    const expandable = entry.changes.length > 0 || snapshot !== null;

    return (
        <li className="px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="w-40 shrink-0 text-xs tabular-nums text-muted">
                    {formatDateTime(entry.created_at)}
                </span>

                <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>

                <span className="text-sm font-medium text-foreground">
                    {entry.entity}
                    {entry.entity_id ? (
                        href ? (
                            <Link
                                href={href}
                                className="ml-1 text-muted underline-offset-2 hover:underline"
                            >
                                #{entry.entity_id}
                            </Link>
                        ) : (
                            <span className="ml-1 text-muted">
                                #{entry.entity_id}
                            </span>
                        )
                    ) : null}
                </span>

                <span className="text-xs text-muted">
                    by {entry.actor_name ?? "an unauthenticated request"}
                    {entry.ip ? ` · ${entry.ip}` : ""}
                </span>

                <span className="ml-auto flex items-center gap-2">
                    {entry.changes.length > 0 ? (
                        <span className="text-xs text-muted">
                            {entry.changes.length} field
                            {entry.changes.length === 1 ? "" : "s"}
                        </span>
                    ) : null}
                    {expandable ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setOpen(!open)}
                            aria-expanded={open}
                            iconOnly
                            aria-label={open ? "Hide detail" : "Show detail"}
                            title={open ? "Hide detail" : "Show detail"}
                        >
                            <Icon
                                name={open ? "chevronUp" : "chevronDown"}
                                className="size-4"
                            />
                        </Button>
                    ) : null}
                </span>
            </div>

            {open ? (
                <div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-muted p-3">
                    {entry.changes.length > 0 ? (
                        <table className="w-full border-collapse text-left text-xs">
                            <thead className="text-muted">
                                <tr>
                                    <th className="pb-2 pr-4 font-medium">
                                        Field
                                    </th>
                                    <th className="pb-2 pr-4 font-medium">
                                        Before
                                    </th>
                                    <th className="pb-2 font-medium">After</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {entry.changes.map((change) => (
                                    <tr key={change.field}>
                                        <td className="py-1.5 pr-4 font-medium text-foreground">
                                            {change.field}
                                        </td>
                                        <td className="py-1.5 pr-4 text-negative">
                                            {show(change.before)}
                                        </td>
                                        <td className="py-1.5 text-positive">
                                            {show(change.after)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : snapshot ? (
                        <>
                            <p className="mb-2 text-xs text-muted">
                                {entry.after
                                    ? "The record as it was created."
                                    : "The record as it stood before it was removed."}
                            </p>
                            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                                {Object.entries(snapshot).map(
                                    ([field, value]) => (
                                        <div
                                            key={field}
                                            className="flex justify-between gap-3 text-xs"
                                        >
                                            <dt className="shrink-0 text-muted">
                                                {field}
                                            </dt>
                                            <dd className="min-w-0 truncate text-right text-foreground">
                                                {show(value)}
                                            </dd>
                                        </div>
                                    )
                                )}
                            </dl>
                        </>
                    ) : null}
                </div>
            ) : null}
        </li>
    );
}

export default function AuditManager({
    page,
    filters,
    facets,
    loadError,
}: Props) {
    const activeFilters = Object.values(filters).filter(Boolean).length;

    function pageHref(target: number): string {
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(filters)) {
            if (value) params.set(key, value);
        }

        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/settings/audit?${query}` : "/settings/audit";
    }

    const from = (page.page - 1) * page.page_size + 1;
    const to = Math.min(page.page * page.page_size, page.total);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 11"
                title="Audit log"
                description={`${page.total.toLocaleString("en-PK")} recorded event${page.total === 1 ? "" : "s"}. Append-only — nothing here can be edited or deleted through the application.`}
            />

            <form
                action="/settings/audit"
                method="get"
                className={`mb-6 ${CARD_CLASS}`}
            >
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Entity">
                        <select
                            name="entity"
                            defaultValue={filters.entity}
                            className={controlClass}
                        >
                            <option value="">All</option>
                            {facets.entities.map((entity) => (
                                <option key={entity} value={entity}>
                                    {entity}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Action">
                        <select
                            name="action"
                            defaultValue={filters.action}
                            className={controlClass}
                        >
                            <option value="">All</option>
                            {facets.actions.map((action) => (
                                <option key={action} value={action}>
                                    {action}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Who">
                        <select
                            name="actor_id"
                            defaultValue={filters.actor_id}
                            className={controlClass}
                        >
                            <option value="">Anyone</option>
                            {facets.actors.map((actor) => (
                                <option key={actor.id} value={String(actor.id)}>
                                    {actor.name}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Record id">
                        <input
                            type="text"
                            name="entity_id"
                            defaultValue={filters.entity_id}
                            placeholder="With an entity, one record's history"
                            className={controlClass}
                        />
                    </Field>

                    <Field label="From">
                        <input
                            type="date"
                            name="from"
                            defaultValue={filters.from}
                            className={controlClass}
                        />
                    </Field>

                    <Field label="To">
                        <input
                            type="date"
                            name="to"
                            defaultValue={filters.to}
                            className={controlClass}
                        />
                    </Field>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border p-3">
                    {activeFilters > 0 ? (
                        <Link
                            href="/settings/audit"
                            className="mr-auto inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                        >
                            <Icon name="close" className="size-3.5" />
                            Clear {activeFilters} filter
                            {activeFilters === 1 ? "" : "s"}
                        </Link>
                    ) : null}
                    <Button type="submit">Apply</Button>
                </div>
            </form>

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            <Card>
                {page.data.length === 0 ? (
                    <div className="px-4 py-14 text-center">
                        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                            <Icon name="history" className="size-5" />
                        </span>
                        <p className="text-sm font-medium text-foreground">
                            Nothing matches these filters
                        </p>
                        <p className="mt-1 text-xs text-muted">
                            Try widening the date range, or clearing them.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {page.data.map((entry) => (
                            <Row key={entry.id} entry={entry} />
                        ))}
                    </ul>
                )}
            </Card>

            {page.total > 0 ? (
                <nav className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-xs text-muted">
                        Showing {from}–{to} of{" "}
                        {page.total.toLocaleString("en-PK")}
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
                                >
                                    <Icon
                                        name="chevronLeft"
                                        className="size-4"
                                    />
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
                                >
                                    <Icon
                                        name="chevronRight"
                                        className="size-4"
                                    />
                                </ButtonLink>
                            ) : null}
                        </div>
                    ) : null}
                </nav>
            ) : null}
        </PageContainer>
    );
}
