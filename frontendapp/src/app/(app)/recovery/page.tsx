import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CARD_CLASS, Card } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    SORT_FIELDS,
    type Recovery,
    type RecoveryFilterValues,
    type RecoverySort,
    type SortDirection,
    type SortField,
    type TierKey,
} from "@/types/recovery";

export const metadata: Metadata = {
    title: "Recovery · SmartPay Solutions",
    description: "Contracts by recovery health",
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/** BR-07's tiers, best to worst. */
const TIER_TONE: Record<TierKey, BadgeTone> = {
    platinum: "solid",
    gold: "accent",
    silver: "neutral",
    caution: "negative",
    awaiting: "neutral",
};

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

const EMPTY: Recovery = {
    rows: { data: [], page: 1, page_size: 25, total: 0, total_pages: 1 },
    totals: {
        contracts: 0,
        past_due: 0,
        settled: 0,
        total_outstanding: "0.00",
        recovered_pct: "0.00",
        by_tier: [],
    },
};

type SearchParams = Partial<Record<keyof RecoveryFilterValues, string>> & {
    page?: string;
    sort?: string;
    dir?: string;
};

function readSort(params: SearchParams): RecoverySort {
    const field = SORT_FIELDS.includes(params.sort as SortField)
        ? (params.sort as SortField)
        : DEFAULT_SORT.field;

    const dir =
        params.dir === "asc" || params.dir === "desc"
            ? params.dir
            : DEFAULT_SORT.dir;

    return { field, dir };
}

/**
 * Module 7 (SRS §4.7), FR-REC-01-v2.
 *
 * A server component throughout: there is nothing interactive here beyond
 * links and a filter form, so no client bundle is needed for it.
 */
export default async function RecoveryPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: RecoveryFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof RecoveryFilterValues)[]).map(
                (key) => [key, params[key]?.trim() ?? ""]
            )
        ),
    };

    const page = Math.max(1, Number(params.page ?? 1) || 1);
    const sort = readSort(params);

    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }
    query.set("sort", sort.field);
    query.set("dir", sort.dir);

    let data = EMPTY;
    let loadError: string | null = null;

    try {
        data = await apiCall<Recovery>(`/recovery?${query.toString()}`);
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load the recovery register: ${error.message}`
                : "Could not load the recovery register.";
    }

    const { rows, totals } = data;

    function hrefWith(overrides: {
        page?: number;
        sort?: SortField;
        dir?: SortDirection;
    }): string {
        const next = new URLSearchParams();

        for (const [key, value] of Object.entries(filters)) {
            if (value) next.set(key, value);
        }

        const field = overrides.sort ?? sort.field;
        const dir = overrides.dir ?? sort.dir;

        if (field !== DEFAULT_SORT.field || dir !== DEFAULT_SORT.dir) {
            next.set("sort", field);
            next.set("dir", dir);
        }

        const target = overrides.page ?? rows.page;
        if (target > 1) next.set("page", String(target));

        const search = next.toString();

        return search ? `/recovery?${search}` : "/recovery";
    }

    const sortLink = (field: SortField, label: string, align = "") => {
        const active = sort.field === field;
        const nextDir: SortDirection =
            active && sort.dir === "asc" ? "desc" : "asc";

        return (
            <th className={`px-4 py-3 font-medium ${align}`}>
                <Link
                    href={hrefWith({ sort: field, dir: nextDir, page: 1 })}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                        active ? "text-foreground" : ""
                    }`}
                >
                    {label}
                    <Icon
                        name={
                            active && sort.dir === "asc"
                                ? "chevronUp"
                                : "chevronDown"
                        }
                        className={`size-3.5 ${
                            active ? "text-brand-ink" : "text-muted/40"
                        }`}
                    />
                </Link>
            </th>
        );
    };

    const from = (rows.page - 1) * rows.page_size + 1;
    const to = Math.min(rows.page * rows.page_size, rows.total);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 7"
                title="Recovery"
                description="Every contract graded by the same reading its own ledger uses — payments applied oldest first, punctuality banded per BR-06-v2."
            />

            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Contracts"
                    value={String(totals.contracts)}
                    hint={`${totals.settled} settled`}
                />
                <StatTile
                    label="Past due"
                    value={String(totals.past_due)}
                    hint="Carrying an uncovered installment"
                />
                <StatTile
                    label="Outstanding"
                    value={pkr(totals.total_outstanding)}
                />
                <StatTile
                    label="Recovered"
                    value={`${totals.recovered_pct}%`}
                    hint="Weighted by financed amount"
                />
            </div>

            {/* BR-07 across the portfolio. Each chip filters to its tier. */}
            {totals.by_tier.length > 0 ? (
                <div className="mb-6 flex flex-wrap gap-2">
                    {totals.by_tier.map((entry) => (
                        <Link
                            key={entry.tier_key}
                            href={
                                filters.tier === entry.tier_key
                                    ? "/recovery"
                                    : `/recovery?tier=${entry.tier_key}`
                            }
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                filters.tier === entry.tier_key
                                    ? "border-chrome-600 bg-surface-muted"
                                    : "border-border hover:bg-surface-muted"
                            }`}
                        >
                            <Badge tone={TIER_TONE[entry.tier_key]}>
                                {entry.tier_label}
                            </Badge>
                            <span className="tabular-nums text-foreground">
                                {entry.count}
                            </span>
                        </Link>
                    ))}
                </div>
            ) : null}

            <form action="/recovery" method="get" className={`mb-6 ${CARD_CLASS}`}>
                <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
                    <div className="relative">
                        <Icon
                            name="search"
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                        />
                        <input
                            type="search"
                            name="search"
                            defaultValue={filters.search}
                            placeholder="Search customer, CNIC or product"
                            className={`${controlClass} pl-9`}
                        />
                    </div>
                    <select
                        name="health"
                        defaultValue={filters.health}
                        className={controlClass}
                        aria-label="Health"
                    >
                        <option value="">Any health</option>
                        <option value="past_due">Past due</option>
                        <option value="on_track">On track</option>
                        <option value="settled">Settled</option>
                    </select>
                    <select
                        name="tier"
                        defaultValue={filters.tier}
                        className={controlClass}
                        aria-label="Tier"
                    >
                        <option value="">Any tier</option>
                        <option value="platinum">Platinum</option>
                        <option value="gold">Gold</option>
                        <option value="silver">Silver</option>
                        <option value="caution">Caution</option>
                        <option value="awaiting">Awaiting data</option>
                    </select>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-chrome-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-chrome-700"
                        >
                            Apply
                        </button>
                        {filters.search || filters.tier || filters.health ? (
                            <ButtonLink
                                href="/recovery"
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
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            {sortLink("customer", "Customer")}
                            <th className="px-4 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Financed
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Paid
                            </th>
                            {sortLink("outstanding", "Outstanding", "text-right")}
                            {sortLink("recovered_pct", "Recovered", "text-right")}
                            {sortLink("net_days", "Lag / advance", "text-right")}
                            {sortLink("tier", "Tier")}
                            <th className="px-4 py-3 text-right font-medium">
                                Ledger
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-4 py-14 text-center text-sm text-muted"
                                >
                                    No contract matches these filters.
                                </td>
                            </tr>
                        ) : (
                            rows.data.map((row) => (
                                <tr
                                    key={row.contract_id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/contracts/${row.contract_id}/ledger`}
                                            className="font-medium underline-offset-2 hover:underline"
                                        >
                                            {row.customer_name}
                                        </Link>
                                        <p className="flex items-center gap-1.5 text-xs text-muted">
                                            {row.reference}
                                            {row.past_due ? (
                                                <Badge tone="negative">
                                                    past due
                                                </Badge>
                                            ) : null}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        {row.product_name}
                                        <p className="text-muted">
                                            {row.completed_installments} of{" "}
                                            {row.plan_months} paid
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.financed_amount)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.paid)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.outstanding)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="tabular-nums">
                                            {row.recovered_pct}%
                                        </span>
                                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
                                            <div
                                                className="h-full rounded-full bg-positive"
                                                style={{
                                                    width: `${row.recovered_pct}%`,
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {row.completed_installments === 0 ? (
                                            <span className="text-muted">—</span>
                                        ) : (
                                            <span
                                                className={
                                                    row.net_days > 0
                                                        ? "text-negative"
                                                        : "text-positive"
                                                }
                                            >
                                                {row.net_days > 0 ? "+" : ""}
                                                {row.net_days} d
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge tone={TIER_TONE[row.tier_key]}>
                                            {row.tier_label}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <ButtonLink
                                            href={`/contracts/${row.contract_id}/ledger`}
                                            variant="secondary"
                                            size="sm"
                                            iconOnly
                                            aria-label={`Open the ledger for ${row.reference}`}
                                            title="Open ledger"
                                        >
                                            <Icon
                                                name="trendingUp"
                                                className="size-4"
                                            />
                                        </ButtonLink>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>

            {rows.total > 0 ? (
                <nav className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-xs text-muted">
                        Showing {from}–{to} of {rows.total}
                    </span>
                    {rows.total_pages > 1 ? (
                        <div className="flex items-center gap-2">
                            {rows.page > 1 ? (
                                <ButtonLink
                                    href={hrefWith({ page: rows.page - 1 })}
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
                                Page {rows.page} of {rows.total_pages}
                            </span>
                            {rows.page < rows.total_pages ? (
                                <ButtonLink
                                    href={hrefWith({ page: rows.page + 1 })}
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
