import type { Metadata } from "next";
import Link from "next/link";
import { CollectionsChart } from "./collections-chart";
import { DashboardFilters } from "./dashboard-filters";
import { MethodBars } from "./method-bars";
import { Scorecards } from "./scorecards";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
    StatTile,
    type StatDelta,
    type StatRate,
} from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Dashboard, Figures, Rate } from "@/types/dashboard";

/**
 * FR-DSH-17. The change in one figure against the period before, as the tile
 * shows it. A percentage where the earlier figure allows one; a plain count
 * when it was zero and the change is a whole number of things; nothing when
 * both are zero.
 */
function deltaOf(
    comparison: Dashboard["comparison"],
    key: keyof Figures,
    good: "up" | "down" = "up"
): StatDelta | undefined {
    if (!comparison) return undefined;

    const now = Number(comparison.current[key]);
    const before = Number(comparison.previous[key]);

    if (now === 0 && before === 0) return undefined;

    const title = `${comparison.current_label} vs ${comparison.previous_label}`;

    // Nothing before: a count can say "▲ 3", but a rupee figure against
    // zero has no percentage and a raw amount beside the value just repeats
    // it — so money reads "new".
    if (before === 0) {
        return key === "contracts" || key === "customers"
            ? { value: now, unit: "", good, title }
            : { value: now, text: "new", good, title };
    }

    return { value: ((now - before) / before) * 100, unit: "%", good, title };
}

/**
 * FR-DSH-20. The move in a percentage, in points: 37% to 41% is "▲ 4%" the
 * way the reference reads it, not an 11% relative rise. Nothing when either
 * side was unmeasured.
 */
function pointsOf(
    comparison: Dashboard["comparison"],
    key:
        | "on_time_pct"
        | "collection_pct"
        | "recovered_pct"
        | "profit_matured_pct"
        | "past_due_pct",
    good: "up" | "down" = "up"
): StatDelta | undefined {
    if (!comparison) return undefined;

    const now = comparison.current[key];
    const before = comparison.previous[key];

    if (now === null || before === null) return undefined;

    return {
        value: Number(now) - Number(before),
        unit: "pts",
        good,
        title: `percentage points, ${comparison.current_label} vs ${comparison.previous_label}`,
    };
}

/**
 * FR-DSH-20. A rate as the card shows it: "71% on time · 14 of 84
 * installments due", with the move in points beside it. Read from the same
 * `rates` block for every card, so the percentages agree with each other.
 */
function rateOf(
    rate: Rate,
    label: string,
    kind: "count" | "money",
    noun: string,
    delta?: StatDelta
): StatRate {
    const of =
        rate.pct === null
            ? noun
            : kind === "count"
              ? `${rate.numerator} of ${rate.denominator} ${noun}`
              : `${pkr(rate.numerator)} of ${pkr(rate.denominator)} ${noun}`;

    return { pct: rate.pct, label, of, delta };
}

export const metadata: Metadata = {
    title: "Dashboard · SmartPay Solutions",
    description: "Portfolio at a glance",
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** FR-DSH-11: `Rs. n,nnn`, no decimals. */
function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ investor?: string; from?: string; to?: string }>;
}) {
    const params = await searchParams;
    const selected = /^\d+$/.test(params.investor ?? "")
        ? (params.investor as string)
        : "";
    const isDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
    const from = isDate(params.from) ? (params.from as string) : "";
    const to = isDate(params.to) ? (params.to as string) : "";

    const query = new URLSearchParams();
    if (selected) query.set("investor_id", selected);
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    // FR-DSH-01..16 in a single aggregate call, replacing v1's nine (NFR-07).
    // The investor lookup drives the filter; without it the page still shows.
    const [data, investors] = await Promise.all([
        apiCall<Dashboard>(
            query.toString() ? `/dashboard?${query.toString()}` : "/dashboard"
        ).catch((error: unknown) =>
            error instanceof Error ? error.message : "failed"
        ),
        apiCall<{ id: number; label: string }[]>("/investors/lookup").catch(
            () => [] as { id: number; label: string }[]
        ),
    ]);

    if (typeof data === "string") {
        return (
            <PageContainer>
                <PageHeader
                    eyebrow="Module 1"
                    title="Dashboard"
                    description="Portfolio at a glance."
                />
                <p className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    Could not load the dashboard: {data}
                </p>
            </PageContainer>
        );
    }

    const { collections, counts, recent_payments, past_due_contracts } = data;
    const scoped = data.investor !== null;
    const periodic = data.period.from !== null || data.period.to !== null;

    /** "1 Jan 2026 to 30 Jun 2026", or one-sided. */
    const periodLabel = [
        data.period.from ? `from ${formatDate(data.period.from)}` : "",
        data.period.to ? `to ${formatDate(data.period.to)}` : "",
    ]
        .filter(Boolean)
        .join(" ");
    const asAt = data.period.to ? formatDate(data.period.to) : "today";
    const { comparison } = data;

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 1"
                title="Dashboard"
                description={
                    scoped
                        ? `${data.investor?.full_name}'s share of every contract their money is in.`
                        : "Every figure derived from the payments and installments tables, so nothing here can drift from the contracts."
                }
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <ButtonLink
                            href="/payments"
                            variant="secondary"
                            stackOnMobile
                        >
                            <Icon name="creditCard" className="size-4" />
                            Record payment
                        </ButtonLink>
                        <ButtonLink href="/contracts/new" stackOnMobile>
                            <Icon name="plus" className="size-4" />
                            New contract
                        </ButtonLink>
                    </div>
                }
            />

            {/* FR-DSH-13 and FR-DSH-16. One row, above everything it scopes. */}
            <div className="mb-6 rounded-xl border border-border bg-surface p-3">
                {/* Keyed on the filters in the URL: the picker and the date
                    boxes keep their own typed state, and a navigation that
                    only changes the query string leaves them mounted — so
                    clearing the filters would clear the URL and not the
                    boxes. A new key remounts them from what the URL says. */}
                <DashboardFilters
                    key={`${selected}|${from}|${to}`}
                    investors={investors}
                    investor={selected}
                    from={from}
                    to={to}
                />
                {scoped || periodic ? (
                    <p className="mt-3 text-xs text-muted">
                        {scoped ? (
                            <>
                                Showing {data.investor?.full_name}&rsquo;s share
                                {" · "}
                                <Link
                                    href={`/investors/${data.investor?.id}`}
                                    className="underline-offset-4 hover:underline"
                                >
                                    open their register →
                                </Link>
                            </>
                        ) : null}
                        {scoped && periodic ? " · " : null}
                        {periodic
                            ? `Collections, new contracts and new customers ${periodLabel}; balances as at ${asAt}.`
                            : null}
                    </p>
                ) : null}
            </div>

            {/* FR-DSH-12 */}
            {past_due_contracts > 0 ? (
                <Link
                    href="/contracts?due=past_due"
                    className="mb-6 flex items-start gap-3 rounded-xl border border-negative/30 bg-negative/8 px-4 py-3 transition-colors hover:bg-negative/12"
                >
                    <Icon
                        name="alert"
                        className="mt-0.5 size-4 shrink-0 text-negative"
                    />
                    <p className="text-sm text-foreground">
                        <span className="font-medium">
                            {past_due_contracts} contract
                            {past_due_contracts === 1 ? " has" : "s have"} an
                            installment past due.
                        </span>{" "}
                        <span className="text-muted">
                            Open the filtered register →
                        </span>
                    </p>
                </Link>
            ) : counts.active_plans > 0 ? (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-positive/30 bg-positive/8 px-4 py-3">
                    <Icon
                        name="check"
                        className="mt-0.5 size-4 shrink-0 text-positive"
                    />
                    <p className="text-sm text-foreground">
                        <span className="font-medium">
                            Nothing is past due.
                        </span>{" "}
                        <span className="text-muted">
                            Every active plan is current on its schedule.
                        </span>
                    </p>
                </div>
            ) : null}

            {/* FR-DSH-01..03. Three tiles go one-up then three-up: a
                two-column step would always leave the third alone in a row. */}
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <StatTile
                    label="Collected today"
                    value={pkr(collections.today)}
                    hint="Non-voided payments dated today"
                    tone="positive"
                    icon="creditCard"
                />
                <StatTile
                    label="Collected this month"
                    value={pkr(collections.month)}
                    hint="Since the 1st"
                    delta={periodic ? undefined : deltaOf(comparison, "collected")}
                    rate={
                        periodic
                            ? undefined
                            : rateOf(
                                  data.rates.collection,
                                  "of what fell due collected",
                                  "money",
                                  "due",
                                  pointsOf(comparison, "collection_pct")
                              )
                    }
                    tone="brand"
                    icon="barChart"
                />
                {periodic && collections.period !== null ? (
                    <StatTile
                        label="Collected in period"
                        value={pkr(collections.period)}
                        hint={periodLabel}
                        delta={deltaOf(comparison, "collected")}
                        rate={rateOf(
                            data.rates.collection,
                            "of what fell due collected",
                            "money",
                            "due",
                            pointsOf(comparison, "collection_pct")
                        )}
                        tone="violet"
                        icon="history"
                    />
                ) : (
                    <StatTile
                        label="Collected all time"
                        value={pkr(collections.all_time)}
                        rate={rateOf(
                            data.rates.recovered,
                            "of everything financed recovered",
                            "money",
                            "financed",
                            pointsOf(comparison, "recovered_pct")
                        )}
                        tone="violet"
                        icon="history"
                    />
                )}
            </div>

            {/* FR-DSH-04-v2, FR-DSH-10-v2 and BR-24 */}
            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Net capital"
                    value={pkr(data.net_capital)}
                    delta={deltaOf(comparison, "net_capital")}
                    hint={`${scoped ? "Deposited less withdrawn" : "All investors, deposited less withdrawn"}${periodic ? `, as at ${asAt}` : ""}`}
                    tone="navy"
                    icon="users"
                    href={
                        scoped ? `/investors/${data.investor?.id}` : "/investors"
                    }
                />
                <StatTile
                    label="Outstanding"
                    value={pkr(data.outstanding)}
                    delta={deltaOf(comparison, "outstanding", "down")}
                    hint={`${scoped ? "Their share, across active plans" : "Across active plans, markup included"}${periodic ? `, as at ${asAt}` : ""}`}
                    tone="warning"
                    icon="alert"
                />
                <StatTile
                    label="Mature profit"
                    value={pkr(data.mature_profit)}
                    delta={deltaOf(comparison, "mature_profit")}
                    rate={rateOf(
                        data.rates.profit_matured,
                        "of the markup earned",
                        "money",
                        "markup",
                        pointsOf(comparison, "profit_matured_pct")
                    )}
                    hint="Earned once a plan has repaid its investment (BR-09)"
                    tone="positive"
                    icon="trendingUp"
                />
                <StatTile
                    label="Unmatured profit"
                    value={pkr(data.unmatured_profit)}
                    hint="Markup still to be earned as plans are collected"
                    tone="brand"
                    icon="trendingUp"
                />
            </div>

            {/* FR-DSH-05..08 */}
            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label={periodic ? "Active plans started" : "Active plans"}
                    value={String(counts.active_plans)}
                    rate={rateOf(
                        data.rates.past_due,
                        "past due",
                        "count",
                        "active plans",
                        pointsOf(comparison, "past_due_pct", "down")
                    )}
                    hint={`of ${counts.contracts} contract${counts.contracts === 1 ? "" : "s"}${periodic ? " started in the period" : ""}`}
                    tone="positive"
                    icon="fileText"
                />
                <StatTile
                    label={periodic ? "Customers added" : "Customers"}
                    value={String(counts.customers)}
                    delta={deltaOf(comparison, "customers")}
                    hint={periodic ? "Registered in the period" : undefined}
                    tone="brand"
                    icon="users"
                    href="/customers"
                />
                <StatTile
                    label="Investors"
                    value={String(counts.active_investors)}
                    hint={
                        scoped
                            ? counts.active_investors === 1
                                ? "Active"
                                : "Inactive"
                            : `of ${counts.investors} on the register`
                    }
                    tone="violet"
                    icon="users"
                    href="/investors"
                />
                <StatTile
                    label={periodic ? "Contracts started" : "Contracts"}
                    value={String(counts.contracts)}
                    delta={deltaOf(comparison, "contracts")}
                    rate={rateOf(
                        data.rates.on_time,
                        "of installments paid on time",
                        "count",
                        "installments due",
                        pointsOf(comparison, "on_time_pct")
                    )}
                    hint={
                        periodic
                            ? "Started in the period, whatever their status now"
                            : "Including completed and cancelled"
                    }
                    tone="navy"
                    icon="dashboard"
                />
            </div>

            {/* FR-DSH-18 */}
            <Scorecards cards={data.scorecards} periodic={periodic} />

            {/* FR-DSH-15 and FR-DSH-19. Filters scope everything below them,
                so both show the same slice as the tiles above. */}
            <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <CollectionsChart
                    title="Collections by month"
                    description={`${
                        scoped
                            ? `${data.investor?.full_name}'s share of what came in, month by month.`
                            : "Split by the investors whose money bought the contracts."
                    }${periodic ? ` Months ${periodLabel}.` : ""}`}
                    months={data.collections_by_month.months}
                    series={data.collections_by_month.series}
                />
                <MethodBars
                    rows={data.collections_by_method}
                    periodic={periodic}
                />
            </div>

            {/* FR-DSH-09 */}
            <Card>
                <CardHeader
                    title="Recent collections"
                    description={
                        scoped
                            ? "The last five payments on contracts they funded, in full."
                            : "The last five payments recorded."
                    }
                    actions={
                        <Link
                            href="/payments"
                            className="text-xs text-muted underline-offset-4 hover:underline"
                        >
                            All payments
                        </Link>
                    }
                />

                {recent_payments.length === 0 ? (
                    <div className="px-4 py-12 text-center sm:px-5">
                        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                            <Icon name="creditCard" className="size-5" />
                        </span>
                        <p className="text-sm font-medium text-foreground">
                            No payments yet
                        </p>
                        <p className="mt-1 text-xs text-muted">
                            Collections appear here as they are recorded.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {recent_payments.map((payment) => (
                            <li
                                key={payment.id}
                                className="flex items-center gap-3 px-4 py-3 sm:px-5"
                            >
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-ink/10 text-brand-ink">
                                    <Icon name="creditCard" className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/contracts/${payment.contract_id}/ledger`}
                                        className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                                    >
                                        {payment.customer_name}
                                    </Link>
                                    <p className="truncate text-xs text-muted">
                                        {payment.product_name} ·{" "}
                                        {formatDate(payment.payment_date)}
                                    </p>
                                </div>
                                <Badge tone="neutral">{payment.method}</Badge>
                                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                                    {pkr(payment.amount)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <p className="mt-4 text-xs text-muted">
                As at {formatDate(data.generated_at)}. Voided payments are
                excluded from every figure.
            </p>
        </PageContainer>
    );
}
