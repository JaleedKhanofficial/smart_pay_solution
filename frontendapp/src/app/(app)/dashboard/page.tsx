import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Dashboard } from "@/types/dashboard";

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

export default async function DashboardPage() {
    // FR-DSH-01..12 in a single aggregate call, replacing v1's nine (NFR-07).
    const data = await apiCall<Dashboard>("/dashboard").catch(
        (error: unknown) => (error instanceof Error ? error.message : "failed")
    );

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

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 1"
                title="Dashboard"
                description="Every figure derived from the payments and installments tables, so nothing here can drift from the contracts."
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
                />
                <StatTile
                    label="Collected this month"
                    value={pkr(collections.month)}
                    hint="Since the 1st"
                />
                <StatTile
                    label="Collected all time"
                    value={pkr(collections.all_time)}
                    hint="Every payment ever taken"
                />
            </div>

            {/* FR-DSH-04-v2 and FR-DSH-10-v2 */}
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <StatTile
                    label="Outstanding"
                    value={pkr(data.outstanding)}
                    hint="Across active plans, markup included"
                />
                <StatTile
                    label="Mature profit"
                    value={pkr(data.mature_profit)}
                    hint="Earned once a plan has repaid its investment (BR-09)"
                />
                <StatTile
                    label="Unmatured profit"
                    value={pkr(data.unmatured_profit)}
                    hint="Markup still to be earned as plans are collected"
                />
            </div>

            {/* FR-DSH-05..08 */}
            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Active plans"
                    value={String(counts.active_plans)}
                    hint={`of ${counts.contracts} contract${counts.contracts === 1 ? "" : "s"}`}
                />
                <StatTile
                    label="Customers"
                    value={String(counts.customers)}
                />
                <StatTile
                    label="Active products"
                    value={String(counts.active_products)}
                />
                <StatTile
                    label="Contracts"
                    value={String(counts.contracts)}
                    hint="Including completed and cancelled"
                />
            </div>

            {/* FR-DSH-09 */}
            <Card>
                <CardHeader
                    title="Recent collections"
                    description="The last five payments recorded."
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
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-muted">
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
