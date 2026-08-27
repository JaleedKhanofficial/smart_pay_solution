import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintLedgerButton } from "./print-button";
import { ApiError } from "@/api/api.repository";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type {
    BandKey,
    Ledger,
    LedgerRow,
    RowStatus,
    TierKey,
} from "@/types/ledger";

export const metadata: Metadata = {
    title: "Recovery ledger · SmartPay Solutions",
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

const STATUS_TONE: Record<RowStatus, BadgeTone> = {
    Pending: "neutral",
    "Short Paid": "negative",
    Paid: "positive",
    Advance: "accent",
};

/** BR-06-v2. Earlier is better, so the scale runs positive → negative. */
const BAND_TONE: Record<BandKey, BadgeTone> = {
    early: "positive",
    on_time: "positive",
    slight_delay: "accent",
    late: "negative",
    very_late: "negative",
    overdue: "negative",
};

const TIER_TONE: Record<TierKey, BadgeTone> = {
    platinum: "solid",
    gold: "accent",
    silver: "neutral",
    caution: "negative",
    awaiting: "neutral",
};

function Figure({
    label,
    value,
    hint,
    strong,
}: {
    label: string;
    value: string;
    hint?: string;
    strong?: boolean;
}) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {label}
            </dt>
            <dd
                className={`tabular-nums ${
                    strong
                        ? "text-lg font-semibold text-foreground"
                        : "text-sm text-foreground"
                }`}
            >
                {value}
            </dd>
            {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
        </div>
    );
}

/** FR-REC-03. The variance column: Exact swallows sub-rupee flooring noise. */
function Variance({ row }: { row: LedgerRow }) {
    if (row.status === "Pending") return <span className="text-muted">—</span>;
    if (row.exact) return <span className="text-muted">Exact</span>;

    return (
        <span className="text-negative">{pkr(row.variance)}</span>
    );
}

export default async function LedgerPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    if (!/^\d+$/.test(id)) notFound();

    const ledger = await apiCall<Ledger>(`/contracts/${id}/ledger`).catch(
        (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;

            throw error;
        }
    );

    if (!ledger) notFound();

    const { contract, summary, tier, rows, distribution } = ledger;
    const busiest = Math.max(1, ...distribution.map((entry) => entry.count));

    // FR-REC-05. Net days is the headline of the alert bar: which way, and how
    // far. Zero is worth saying too — it means the plan is running exactly.
    const lag = summary.net_days;

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 7"
                title={`Recovery ledger - ${contract.customer_name}`}
                description={`Contract # ${contract.id} · ${contract.product_name} · ${formatDate(contract.start_date)} to ${formatDate(contract.end_date)}`}
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <ButtonLink
                            href={`/payments?contract_id=${contract.id}`}
                            variant="secondary"
                            stackOnMobile
                        >
                            <Icon name="creditCard" className="size-4" />
                            Payments
                        </ButtonLink>
                        <PrintLedgerButton />
                    </div>
                }
            />

            {/* FR-REC-05 */}
            {summary.completed_installments > 0 ? (
                <div
                    className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 ${
                        lag > 0
                            ? "border-negative/30 bg-negative/8"
                            : "border-positive/30 bg-positive/8"
                    }`}
                >
                    <Icon
                        name={lag > 0 ? "alert" : "check"}
                        className={`mt-0.5 size-4 shrink-0 ${
                            lag > 0 ? "text-negative" : "text-positive"
                        }`}
                    />
                    <p className="text-sm text-foreground">
                        <span className="font-medium">
                            {lag > 0
                                ? `Net lag of ${lag} day${lag === 1 ? "" : "s"}.`
                                : lag < 0
                                  ? `Net advance of ${Math.abs(lag)} day${lag === -1 ? "" : "s"}.`
                                  : "Running exactly to schedule."}
                        </span>{" "}
                        <span className="text-muted">
                            Netted across {summary.completed_installments}{" "}
                            completed installment
                            {summary.completed_installments === 1 ? "" : "s"} - a
                            month paid early offsets one paid late.
                        </span>
                    </p>
                </div>
            ) : null}

            {/* FR-REC-04 */}
            <Card className="mb-6">
                <CardHeader
                    title="Summary"
                    description="Derived from the schedule and the payments table - never stored, so it cannot disagree with the money."
                />
                <dl className="grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-6">
                    <Figure
                        label="Recovered"
                        value={`${summary.recovered_pct}%`}
                        strong
                        hint={`${summary.completed_installments} of ${summary.plan_months} installments`}
                    />
                    <Figure label="Total payable" value={pkr(summary.total_payable)} />
                    <Figure label="Down payment" value={pkr(summary.down_payment)} />
                    <Figure label="Financed" value={pkr(summary.financed_amount)} />
                    <Figure label="Paid to date" value={pkr(summary.total_paid)} />
                    <Figure
                        label="Outstanding"
                        value={pkr(summary.outstanding)}
                        strong
                    />
                </dl>

                <div className="border-t border-border px-4 py-3 sm:px-5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                            className="h-full rounded-full bg-positive transition-all"
                            style={{ width: `${summary.recovered_pct}%` }}
                        />
                    </div>
                </div>
            </Card>

            <div className="mb-6 grid gap-6 lg:grid-cols-3">
                {/* FR-REC-06 */}
                <Card className="lg:col-span-1">
                    <CardHeader
                        title="Loyalty tier"
                        actions={
                            <Badge tone={TIER_TONE[tier.key]}>{tier.label}</Badge>
                        }
                    />
                    <div className="px-4 py-4 sm:px-5">
                        {tier.key === "awaiting" ? (
                            <p className="text-sm text-muted">{tier.behaviour}</p>
                        ) : (
                            <>
                                <p className="text-3xl font-semibold tabular-nums text-foreground">
                                    {tier.reduction_pct}%
                                </p>
                                <p className="text-xs text-muted">
                                    advisory reduction
                                </p>
                                <p className="mt-3 text-sm text-foreground">
                                    {tier.behaviour}
                                </p>
                            </>
                        )}
                        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                            {tier.reward}
                        </p>
                    </div>
                </Card>

                {/* FR-REC-05 */}
                <Card className="lg:col-span-2">
                    <CardHeader
                        title="Punctuality"
                        description="Completed installments by how long after the due date they were settled."
                    />
                    <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                        {distribution.map((entry) => (
                            <div
                                key={entry.key}
                                className="flex items-center gap-3"
                            >
                                <span className="w-32 shrink-0 truncate text-xs text-muted">
                                    {entry.label}
                                </span>
                                <div className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-surface-muted">
                                    <div
                                        className={`h-full rounded ${
                                            BAND_TONE[entry.key] === "positive"
                                                ? "bg-positive"
                                                : BAND_TONE[entry.key] ===
                                                    "negative"
                                                  ? "bg-negative"
                                                  : "bg-brand"
                                        }`}
                                        style={{
                                            width: `${(entry.count / busiest) * 100}%`,
                                        }}
                                    />
                                </div>
                                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-foreground">
                                    {entry.count}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* FR-REC-03 */}
            <Card className="overflow-x-auto">
                <CardHeader
                    title="Month by month"
                    description="Payments applied oldest due date first (BR-13); a row is graded by the payment that completed it."
                />
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">#</th>
                            <th className="px-4 py-3 font-medium">Due</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Required
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Applied
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Variance
                            </th>
                            <th className="px-4 py-3 font-medium">Completed</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Days
                            </th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Punctuality</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map((row) => (
                            <tr
                                key={row.seq}
                                className="align-middle text-foreground"
                            >
                                <td className="px-4 py-3 tabular-nums text-muted">
                                    {row.seq}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                    {formatDate(row.due_date)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {pkr(row.required)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {pkr(row.applied)}
                                </td>
                                <td className="px-4 py-3 text-right text-xs tabular-nums">
                                    <Variance row={row} />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                    {row.completed_on
                                        ? formatDate(row.completed_on)
                                        : "—"}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {row.days_late === null ? (
                                        "—"
                                    ) : (
                                        <span
                                            className={
                                                row.days_late > 0
                                                    ? "text-negative"
                                                    : "text-positive"
                                            }
                                        >
                                            {row.days_late > 0 ? "+" : ""}
                                            {row.days_late}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <Badge tone={STATUS_TONE[row.status]}>
                                        {row.status}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                    {row.band_key ? (
                                        <Badge tone={BAND_TONE[row.band_key]}>
                                            {row.band_label}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <p className="mt-4 text-xs">
                Generated {formatDate(ledger.generated_at)} ·{" "}
                <Link
                    href={`/contracts/${contract.id}/edit`}
                    className="underline-offset-4 hover:underline"
                >
                    Contract #{contract.id}
                </Link>
            </p>
        </PageContainer>
    );
}
