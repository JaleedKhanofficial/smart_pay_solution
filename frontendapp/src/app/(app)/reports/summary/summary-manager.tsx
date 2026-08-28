"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientProfileModal } from "./client-profile-modal";
import { EntriesPanel } from "./entries-panel";
import { SummaryActions } from "./summary-actions";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CARD_CLASS, Card, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
    DEFAULT_SORT,
    SEARCH_SCOPES,
    type ClientProfile,
    type ScoreBand,
    type SortDirection,
    type SortField,
    type Summary,
    type SummaryFilterValues,
    type SummarySort,
} from "@/types/report";

type Props = {
    summary: Summary;
    filters: SummaryFilterValues;
    sort: SummarySort;
    loadError: string | null;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/** BR-11's bands, as the workbook has always coloured them. */
const BAND_TONE: Record<ScoreBand, BadgeTone> = {
    green: "positive",
    gold: "accent",
    red: "negative",
};

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

function SortableHeader({
    field,
    label,
    sort,
    hrefFor,
    className = "",
}: {
    field: SortField;
    label: string;
    sort: SummarySort;
    hrefFor: (field: SortField, dir: SortDirection) => string;
    className?: string;
}) {
    const active = sort.field === field;
    const nextDir: SortDirection = active && sort.dir === "asc" ? "desc" : "asc";

    return (
        <th className={`px-3 py-3 font-medium ${className}`}>
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

export default function SummaryManager({
    summary,
    filters,
    sort,
    loadError,
}: Props) {
    const { rows, totals, capital, expenses, deal_types, missing } = summary;
    const investors = summary.investors;

    // BR-25. Only worth distinguishing the house's figures from the
    // portfolio's when somebody else's money is in the portfolio.
    const funded = Number(investors?.deployed ?? 0) > 0;
    const [showMissing, setShowMissing] = useState(false);
    const [profile, setProfile] = useState<ClientProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState<number | null>(null);

    /**
     * FR-SUM-07. The profile is fetched rather than assembled from the page:
     * a client's other deals may be on a page you are not looking at, and a
     * profile missing half their business would be worse than none.
     */
    async function openProfile(customerId: number) {
        setLoadingProfile(customerId);

        try {
            const response = await fetch(`/api/clients/${customerId}`);

            if (response.ok) {
                setProfile((await response.json()) as ClientProfile);
            }
        } finally {
            setLoadingProfile(null);
        }
    }

    function hrefWith(overrides: {
        page?: number;
        sort?: SortField;
        dir?: SortDirection;
    }): string {
        const params = new URLSearchParams();

        if (filters.search) params.set("search", filters.search);
        if (filters.scope && filters.scope !== "all") {
            params.set("scope", filters.scope);
        }

        const field = overrides.sort ?? sort.field;
        const dir = overrides.dir ?? sort.dir;

        if (field !== DEFAULT_SORT.field || dir !== DEFAULT_SORT.dir) {
            params.set("sort", field);
            params.set("dir", dir);
        }

        const target = overrides.page ?? rows.page;
        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/reports/summary?${query}` : "/reports/summary";
    }

    const pageHref = (target: number) => hrefWith({ page: target });
    const sortHref = (field: SortField, dir: SortDirection) =>
        hrefWith({ sort: field, dir, page: 1 });

    const from = (rows.page - 1) * rows.page_size + 1;
    const to = Math.min(rows.page * rows.page_size, rows.total);
    const missingCount = missing.no_mobile.length + missing.no_cnic.length;

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 8"
                title="Summary report"
                description="Every column derived server-side from the contracts and the payments table, so the workbook cannot disagree with the registers."
                actions={<SummaryActions summary={summary} />}
            />

            {/* FR-SUM-07 */}
            {summary.top_performer ? (
                <button
                    type="button"
                    onClick={() =>
                        openProfile(summary.top_performer!.customer_id)
                    }
                    className={`mb-6 w-full ${CARD_CLASS} p-4 text-left transition-colors hover:bg-surface-muted`}
                >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-positive/12 text-positive">
                            <Icon name="trendingUp" className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                                Top performer
                            </p>
                            <p className="truncate text-sm font-medium text-foreground">
                                {summary.top_performer.customer_name}
                            </p>
                            <p className="text-xs text-muted">
                                {summary.top_performer.deals} deal
                                {summary.top_performer.deals === 1 ? "" : "s"} ·{" "}
                                {pkr(summary.top_performer.total_paid)} collected
                                · {pkr(summary.top_performer.total_outstanding)}{" "}
                                outstanding
                            </p>
                        </div>
                        <Badge tone={BAND_TONE[summary.top_performer.band]}>
                            {summary.top_performer.score}
                        </Badge>
                    </div>
                </button>
            ) : null}

            {loadError ? (
                <p className="mb-6 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            {/* FR-SUM-03. Portfolio counters — these are whole-portfolio
                figures and do not move when the table below is narrowed. */}
            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Deals"
                    value={String(totals.deals)}
                    hint={`${totals.completed} completed · ${totals.in_progress} running`}
                />
                <StatTile
                    label="Outstanding"
                    value={pkr(totals.total_outstanding)}
                    hint="Across every running plan"
                />
                <StatTile
                    label="Collected"
                    value={pkr(totals.total_paid)}
                    hint={`of ${pkr(totals.total_sale)} written`}
                />
                <StatTile
                    label="Average markup"
                    value={`${totals.average_markup_pct}%`}
                    hint="As actually written, not intended"
                />
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Mature profit"
                    value={pkr(totals.mature_profit)}
                    hint="Earned — the investment is back"
                />
                <StatTile
                    label="Unmatured profit"
                    value={pkr(totals.unmatured_profit)}
                    hint="Still to be earned as plans collect"
                />
                <StatTile
                    label="Total profit"
                    value={pkr(totals.total_profit)}
                />
                <StatTile
                    label="Net balance"
                    value={pkr(totals.net_balance)}
                    hint={
                        funded
                            ? "Own capital + house unmatured − expenses − house outstanding"
                            : "Capital + unmatured − expenses − outstanding"
                    }
                />
            </div>

            {/* BR-25 / FR-SUM-11. Only shown once investors hold part of the
                portfolio: with none, the house's figures are the portfolio's
                and a second identical row would say nothing. */}
            {funded ? (
                <Card className="mb-6">
                    <CardHeader
                        title="The house's own position"
                        description="BR-25. The counters above are the whole portfolio; these are the part of it the business owns."
                    />

                    <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                        <StatTile
                            label="House outstanding"
                            value={pkr(totals.house_outstanding)}
                            hint={`of ${pkr(totals.total_outstanding)} owed by customers`}
                        />
                        <StatTile
                            label="House unmatured profit"
                            value={pkr(totals.house_unmatured_profit)}
                            hint={`of ${pkr(totals.unmatured_profit)} still to be earned`}
                        />
                        <StatTile
                            label="Investor capital deployed"
                            value={pkr(investors.deployed)}
                            hint={`${pkr(investors.available)} idle`}
                        />
                        <StatTile
                            label="Owed to investors"
                            value={pkr(investors.payable)}
                            hint={`${investors.investors} investor${investors.investors === 1 ? "" : "s"} · ${pkr(investors.lifetime_profit)} profit earned`}
                        />
                    </div>

                    <dl className="grid gap-4 border-t border-border px-4 py-4 text-sm sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                        <div>
                            <dt className="text-xs text-muted">Deposited</dt>
                            <dd className="tabular-nums text-foreground">
                                {pkr(investors.deposited)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted">Withdrawn</dt>
                            <dd className="tabular-nums text-foreground">
                                {pkr(investors.withdrawn)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted">
                                Principal in play
                            </dt>
                            <dd className="tabular-nums text-foreground">
                                {pkr(investors.principal_deployed)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted">
                                Profit in play
                            </dt>
                            <dd className="tabular-nums text-foreground">
                                {/* BR-23. Reinvested profit, working again. */}
                                {pkr(investors.profit_deployed)}
                            </dd>
                        </div>
                    </dl>
                </Card>
            ) : null}

            {/* FR-SUM-03. The Deal Counter banner. */}
            {deal_types.length > 0 ? (
                <Card className="mb-6">
                    <CardHeader
                        title="Deal counter"
                        description="Categories by share of the portfolio's written value."
                    />
                    <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                        {deal_types.map((entry) => (
                            <div
                                key={entry.deal_type}
                                className="flex items-center gap-3"
                            >
                                <span className="w-32 shrink-0 truncate text-xs text-foreground">
                                    {entry.deal_type}
                                </span>
                                <div className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-surface-muted">
                                    <div
                                        className="h-full rounded bg-chrome-700"
                                        style={{ width: `${entry.share_pct}%` }}
                                    />
                                </div>
                                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-foreground">
                                    {entry.share_pct}%
                                </span>
                                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted">
                                    {entry.deals} deal
                                    {entry.deals === 1 ? "" : "s"}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            ) : null}

            {/* FR-SUM-02-v2 */}
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <EntriesPanel
                    kind="capital"
                    title="Capital"
                    description="Money the business has put in. Feeds the net balance (BR-10)."
                    total={capital.total}
                    entries={capital.entries}
                />
                <EntriesPanel
                    kind="expenses"
                    title="Expenses"
                    description="Costs to subtract from the net balance."
                    total={expenses.total}
                    entries={expenses.entries}
                />
            </div>

            {/* FR-SUM-06 */}
            {missingCount > 0 ? (
                <div className="mb-6 rounded-xl border border-brand/30 bg-brand/8 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setShowMissing(!showMissing)}
                        className="flex w-full items-start gap-3 text-left"
                    >
                        <Icon
                            name="alert"
                            className="mt-0.5 size-4 shrink-0 text-brand-ink"
                        />
                        <p className="flex-1 text-sm text-foreground">
                            <span className="font-medium">
                                {missing.no_mobile.length} client
                                {missing.no_mobile.length === 1 ? "" : "s"}{" "}
                                without a mobile number,{" "}
                                {missing.no_cnic.length} without a CNIC.
                            </span>{" "}
                            <span className="text-muted">
                                {showMissing ? "Hide" : "Show"} them
                            </span>
                        </p>
                        <Icon
                            name={showMissing ? "chevronUp" : "chevronDown"}
                            className="mt-0.5 size-4 shrink-0 text-muted"
                        />
                    </button>

                    {showMissing ? (
                        <div className="mt-3 grid gap-4 border-t border-brand/20 pt-3 sm:grid-cols-2">
                            {(
                                [
                                    ["No mobile", missing.no_mobile],
                                    ["No CNIC", missing.no_cnic],
                                ] as const
                            ).map(([label, list]) => (
                                <div key={label}>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                                        {label}
                                    </p>
                                    {list.length === 0 ? (
                                        <p className="text-xs text-muted">
                                            None
                                        </p>
                                    ) : (
                                        <ul className="space-y-1">
                                            {list.map((client) => (
                                                <li key={client.customer_id}>
                                                    <Link
                                                        href={`/customers/${client.customer_id}/edit`}
                                                        className="text-xs text-foreground underline-offset-2 hover:underline"
                                                    >
                                                        {client.customer_name}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* FR-SUM-05 */}
            <form
                action="/reports/summary"
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
                            defaultValue={filters.search}
                            placeholder="Search the workbook"
                            className={`${controlClass} pl-9`}
                        />
                    </div>
                    <select
                        name="scope"
                        defaultValue={filters.scope}
                        className={`${controlClass} sm:w-40`}
                        aria-label="Search scope"
                    >
                        {SEARCH_SCOPES.map((scope) => (
                            <option key={scope} value={scope}>
                                {scope === "all"
                                    ? "Everything"
                                    : scope === "cnic"
                                      ? "CNIC"
                                      : scope.charAt(0).toUpperCase() +
                                        scope.slice(1)}
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <Button type="submit" className="flex-1 sm:flex-none">
                            Search
                        </Button>
                        {filters.search ? (
                            <ButtonLink
                                href="/reports/summary"
                                variant="secondary"
                                iconOnly
                                aria-label="Clear search"
                                title="Clear"
                            >
                                <Icon name="close" className="size-4" />
                            </ButtonLink>
                        ) : null}
                    </div>
                </div>
                {filters.search ? (
                    <p className="border-t border-border px-3 py-2 text-xs text-muted">
                        {rows.total} of {totals.deals} deal
                        {totals.deals === 1 ? "" : "s"} match.
                    </p>
                ) : null}
            </form>

            {/* FR-SUM-01-v2 / FR-SUM-03. The ledger table. */}
            <Card className="overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <SortableHeader
                                field="customer_name"
                                label="Client"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <th className="px-3 py-3 font-medium">Deal type</th>
                            <SortableHeader
                                field="sale_price"
                                label="Sale"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                            <th className="px-3 py-3 text-right font-medium">
                                Markup
                            </th>
                            <th className="px-3 py-3 text-right font-medium">
                                Total
                            </th>
                            <th className="px-3 py-3 text-right font-medium">
                                Down
                            </th>
                            <th className="px-3 py-3 text-right font-medium">
                                Financed
                            </th>
                            <SortableHeader
                                field="paid"
                                label="Paid"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                            <SortableHeader
                                field="outstanding"
                                label="Outstanding"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                            <SortableHeader
                                field="pct_completed"
                                label="%"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                            <SortableHeader
                                field="score"
                                label="Score"
                                sort={sort}
                                hrefFor={sortHref}
                                className="text-right"
                            />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={11}
                                    className="px-4 py-14 text-center text-sm text-muted"
                                >
                                    {filters.search
                                        ? "No deal matches this search."
                                        : "No contracts yet."}
                                </td>
                            </tr>
                        ) : (
                            rows.data.map((row) => (
                                <tr
                                    key={row.contract_id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openProfile(row.customer_id)
                                            }
                                            disabled={
                                                loadingProfile ===
                                                row.customer_id
                                            }
                                            className="text-left font-medium underline-offset-2 hover:underline"
                                        >
                                            {row.customer_name}
                                        </button>
                                        <p className="text-xs tabular-nums text-muted">
                                            {row.customer_mobile} ·{" "}
                                            <Link
                                                href={`/contracts/${row.contract_id}/ledger`}
                                                className="underline-offset-2 hover:underline"
                                            >
                                                ledger
                                            </Link>
                                        </p>
                                    </td>
                                    <td className="px-3 py-3 text-xs">
                                        {row.deal_type}
                                        <p className="text-muted">
                                            {row.product_name}
                                        </p>
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {pkr(row.sale_price)}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {pkr(row.markup_amount)}
                                        <p className="text-xs text-muted">
                                            {row.actual_markup_pct}%
                                        </p>
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {pkr(row.total_sale)}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {pkr(row.down_payment)}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {pkr(row.rem_balance)}
                                        <p className="text-xs text-muted">
                                            {row.plan_months} mo
                                        </p>
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {pkr(row.paid)}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {pkr(row.outstanding)}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {row.pct_completed}%
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <Badge tone={BAND_TONE[row.band]}>
                                            {row.score}
                                        </Badge>
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
                                    href={pageHref(rows.page - 1)}
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
                                    href={pageHref(rows.page + 1)}
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

            <p className="mt-4 text-xs text-muted">
                As at {formatDate(summary.generated_at)}. Voided payments are
                excluded from every figure.
            </p>

            <ClientProfileModal
                profile={profile}
                onClose={() => setProfile(null)}
            />
        </PageContainer>
    );
}
