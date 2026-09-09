import type { Metadata } from "next";
import Link from "next/link";
import { FundingActions } from "./funding-actions";
import { FundingFilters } from "./funding-filters";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    EMPTY_REPORT,
    SORT_FIELDS,
    type FundingFilterValues,
    type FundingReport,
    type FundingSort,
    type SortDirection,
    type SortField,
} from "@/types/funding-report";
import type { ContractStatus } from "@/types/contract";
import type { BusinessIdentity, Setting } from "@/types/setting";

export const metadata: Metadata = {
    title: "Funding register · SmartPay Solutions",
    description: "Which investors bought which contracts",
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

const STATUS_TONE: Record<ContractStatus, BadgeTone> = {
    active: "accent",
    completed: "positive",
    cancelled: "negative",
};

type SearchParams = Partial<Record<keyof FundingFilterValues, string>> & {
    sort?: string;
    dir?: string;
};

function readSort(params: SearchParams): FundingSort {
    const field = SORT_FIELDS.find((entry) => entry === params.sort);
    const dir: SortDirection = params.dir === "asc" ? "asc" : "desc";

    return field ? { field, dir } : DEFAULT_SORT;
}

/** A column header that carries the sort into the query string. */
function SortLink({
    field,
    label,
    sort,
    params,
    align = "left",
}: {
    field: SortField;
    label: string;
    sort: FundingSort;
    params: SearchParams;
    align?: "left" | "right";
}) {
    const active = sort.field === field;
    const next = active && sort.dir === "desc" ? "asc" : "desc";

    const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value) as [
            string,
            string,
        ][]
    );

    query.set("sort", field);
    query.set("dir", next);

    return (
        <Link
            href={`/reports/funding?${query.toString()}`}
            className={`inline-flex items-center gap-1 hover:text-foreground ${
                active ? "text-foreground" : ""
            } ${align === "right" ? "flex-row-reverse" : ""}`}
        >
            {label}
            {active ? (
                <Icon
                    name={sort.dir === "asc" ? "chevronUp" : "chevronDown"}
                    className="size-3"
                />
            ) : null}
        </Link>
    );
}

/**
 * FR-IVT-16. The funding register: whose money bought which contract, and
 * whether each deal was taken by one investor alone or shared between several.
 *
 * Separate from the Summary Report on purpose. That workbook answers how the
 * business is doing; this answers whose money is in what — a different question
 * with a different audience, which is why it is a page of its own rather than
 * another card on a report that is already long.
 */
export default async function FundingReportPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: FundingFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (
                Object.keys(EMPTY_FILTERS) as (keyof FundingFilterValues)[]
            ).map((key) => [key, params[key]?.trim() ?? ""])
        ),
    };

    const sort = readSort(params);

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }
    query.set("sort", sort.field);
    query.set("dir", sort.dir);

    let report: FundingReport = EMPTY_REPORT;
    let loadError: string | null = null;

    try {
        report = await apiCall<FundingReport>(
            `/reports/funding?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load the funding register: ${error.message}`
                : "Could not load the funding register.";
    }

    /**
     * The letterhead for the PDF. `/settings` answers with the whole registry,
     * so the one entry is picked out here rather than adding a route for it.
     *
     * A failed read costs the name on the header and nothing else: the report
     * still renders and still downloads, under the default name.
     */
    const business = await apiCall<Setting[]>("/settings")
        .then(
            (settings) =>
                settings.find((entry) => entry.key === "business_identity")
                    ?.value as BusinessIdentity | undefined
        )
        .catch(() => undefined);

    const { rows, investors, totals } = report;
    const filtered = Object.values(filters).some(Boolean);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 13"
                title="Funding register"
                description="Whose capital bought which contract, and what it has returned. Every figure is derived from the funding rows and the payments — nothing here is stored."
                actions={
                    <FundingActions
                        report={report}
                        filters={filters}
                        businessName={business?.name ?? "SmartPay Solutions"}
                    />
                }
            />

            {loadError ? (
                <p className="mb-6 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Funded contracts"
                    value={String(totals.contracts)}
                    hint={`${totals.sole} sole · ${totals.joint} joint`}
                />
                <StatTile
                    label="Capital deployed"
                    value={pkr(totals.funded)}
                    hint={`across ${totals.investors} investor${totals.investors === 1 ? "" : "s"}`}
                />
                <StatTile
                    label="Still out"
                    value={pkr(totals.capital_outstanding)}
                    hint={`${pkr(totals.capital_recovered)} has come back`}
                />
                <StatTile
                    label="Profit earned"
                    value={pkr(totals.matured_profit)}
                    hint={`${pkr(totals.unmatured_profit)} still to mature (BR-09)`}
                />
            </div>

            <FundingFilters values={filters} investors={investors} />

            {/* FR-IVT-16. The same rows read down the other axis. Hidden with
                one investor, where it would only repeat the table below. */}
            {investors.length > 1 ? (
                <Card className="mb-6 overflow-x-auto">
                    <CardHeader
                        title="By investor"
                        description="Each investor's position across the deals shown below."
                    />
                    <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                            <tr>
                                <th className="px-4 py-3 font-medium">
                                    Investor
                                </th>
                                <th className="px-4 py-3 font-medium">Deals</th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Funded
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Recovered
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Still out
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Profit
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {investors.map((investor) => (
                                <tr key={investor.investor_id}>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/investors/${investor.investor_id}`}
                                            className="font-medium text-foreground hover:underline"
                                        >
                                            {investor.investor_name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted">
                                        {investor.contracts} ·{" "}
                                        {investor.sole} sole,{" "}
                                        {investor.joint} joint
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                                        {pkr(investor.funded)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                                        {pkr(investor.capital_recovered)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(investor.capital_outstanding)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        <span
                                            className={
                                                Number(
                                                    investor.matured_profit
                                                ) > 0
                                                    ? "font-medium text-positive"
                                                    : "text-muted"
                                            }
                                        >
                                            {pkr(investor.matured_profit)}
                                        </span>
                                        <p className="text-[11px] font-normal text-muted">
                                            {Number(investor.unmatured_profit) >
                                            0
                                                ? `${pkr(investor.unmatured_profit)} to come`
                                                : "fully earned"}
                                        </p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            ) : null}

            <Card className="overflow-x-auto">
                <CardHeader
                    title="By contract"
                    description="Each deal with the investors behind it. A sole deal was bought by one investor; a joint deal was shared."
                />
                <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">
                                <SortLink
                                    field="contract_id"
                                    label="Contract"
                                    sort={sort}
                                    params={params}
                                />
                            </th>
                            <th className="px-4 py-3 font-medium">
                                <SortLink
                                    field="customer_name"
                                    label="Customer"
                                    sort={sort}
                                    params={params}
                                />
                            </th>
                            <th className="px-4 py-3 font-medium">Raised</th>
                            <th className="px-4 py-3 text-right font-medium">
                                <SortLink
                                    field="funded"
                                    label="Cost"
                                    sort={sort}
                                    params={params}
                                    align="right"
                                />
                            </th>
                            <th className="px-4 py-3 font-medium">
                                Investors and their stakes
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Still out
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Profit
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-12 text-center text-sm text-muted"
                                >
                                    {filtered
                                        ? "No funded contract matches these filters."
                                        : "No contract has been funded yet."}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.contract_id} className="align-top">
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/contracts/${row.contract_id}/ledger`}
                                            className="font-medium text-foreground hover:underline"
                                        >
                                            {row.reference}
                                        </Link>
                                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                                            <Badge
                                                tone={STATUS_TONE[row.status]}
                                            >
                                                {row.status}
                                            </Badge>
                                            {row.deleted ? (
                                                <Badge tone="neutral">
                                                    in bin
                                                </Badge>
                                            ) : null}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-foreground">
                                            {row.customer_name}
                                        </span>
                                        <p className="text-[11px] text-muted">
                                            {row.product_name} ·{" "}
                                            {formatDate(row.start_date)}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge
                                            tone={
                                                row.arrangement === "joint"
                                                    ? "accent"
                                                    : "neutral"
                                            }
                                        >
                                            {row.arrangement === "joint"
                                                ? `Joint · ${row.investor_count}`
                                                : "Sole"}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                                        {pkr(row.cost_price)}
                                        <p className="text-[11px] font-normal text-muted">
                                            {pkr(row.recovered)} collected
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <ul className="flex flex-col gap-1">
                                            {row.stakes.map((stake) => (
                                                <li
                                                    key={stake.investor_id}
                                                    className="flex flex-wrap items-baseline gap-x-2 text-xs"
                                                >
                                                    <Link
                                                        href={`/investors/${stake.investor_id}`}
                                                        className="font-medium text-foreground hover:underline"
                                                    >
                                                        {stake.investor_name}
                                                    </Link>
                                                    <span className="tabular-nums">
                                                        {pkr(stake.amount)}
                                                    </span>
                                                    <span className="tabular-nums text-muted">
                                                        {stake.share_pct}%
                                                    </span>
                                                    {stake.reinvested ? (
                                                        <Badge tone="positive">
                                                            reinvested
                                                        </Badge>
                                                    ) : null}
                                                    {Number(
                                                        stake.matured_profit
                                                    ) > 0 ? (
                                                        <span className="tabular-nums text-positive">
                                                            +
                                                            {pkr(
                                                                stake.matured_profit
                                                            )}
                                                        </span>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {pkr(row.capital_outstanding)}
                                        <p className="text-[11px] font-normal text-muted">
                                            of {pkr(row.funded)}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {/* BR-09. Profit only exists once the
                                            capital behind it is whole, so a
                                            running deal usually shows zero
                                            earned and its whole share to come. */}
                                        <span
                                            className={
                                                Number(row.matured_profit) > 0
                                                    ? "font-medium text-positive"
                                                    : "text-muted"
                                            }
                                        >
                                            {pkr(row.matured_profit)}
                                        </span>
                                        <p className="text-[11px] font-normal text-muted">
                                            {Number(row.unmatured_profit) > 0
                                                ? `${pkr(row.unmatured_profit)} to come`
                                                : "fully earned"}
                                        </p>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>
        </PageContainer>
    );
}
