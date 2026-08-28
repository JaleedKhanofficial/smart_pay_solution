import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MovementPanel } from "./movement-panel";
import { ApiError } from "@/api/api.repository";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { InvestorDetail, TxnType } from "@/types/investor";

export const metadata: Metadata = {
    title: "Investor · SmartPay Solutions",
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/** FR-IVT-07. Only the first three are hand-entered. */
const TXN_TONE: Record<TxnType, BadgeTone> = {
    Deposit: "positive",
    Withdrawal: "neutral",
    Adjustment: "accent",
    Loss: "negative",
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
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {label}
            </dt>
            <dd
                className={`tabular-nums ${
                    strong
                        ? "text-base font-semibold text-foreground"
                        : "text-sm text-foreground"
                }`}
            >
                {value}
            </dd>
            {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
        </div>
    );
}

export default async function InvestorPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    if (!/^\d+$/.test(id)) notFound();

    const investor = await apiCall<InvestorDetail>(`/investors/${id}`).catch(
        (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;

            throw error;
        }
    );

    if (!investor) notFound();

    const { balances, transactions } = investor;

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 13"
                title={investor.full_name}
                description={`${investor.cnic_number}  |  ${investor.mobile_number}  |  ${investor.profit_share_pct}% profit share${investor.agreement_date ? `  |  agreed ${formatDate(investor.agreement_date)}` : ""}`}
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {investor.status === "inactive" ? (
                            <Badge tone="neutral">inactive</Badge>
                        ) : null}
                        <ButtonLink
                            href="/investors"
                            variant="secondary"
                            stackOnMobile
                        >
                            <Icon name="chevronLeft" className="size-4" />
                            All investors
                        </ButtonLink>
                    </div>
                }
            />

            {/* FR-IVT-09. Three rows: principal, profit, position. */}
            <Card className="mb-6">
                <CardHeader
                    title="Position"
                    description="Every figure derived from the ledger below — nothing here is stored."
                />

                <dl className="grid gap-4 border-b border-border px-4 py-4 sm:grid-cols-3 sm:px-5">
                    <Figure
                        label="Net principal"
                        value={pkr(balances.net_principal)}
                        hint="Deposited, less withdrawn and adjusted"
                    />
                    <Figure
                        label="Principal idle"
                        value={pkr(balances.principal_available)}
                    />
                    <Figure
                        label="Principal deployed"
                        value={pkr(balances.principal_deployed)}
                    />
                </dl>

                <dl className="grid gap-4 border-b border-border px-4 py-4 sm:grid-cols-3 sm:px-5">
                    <Figure
                        label="Profit earned"
                        value={pkr(balances.lifetime_profit)}
                        hint="Lifetime, even once withdrawn"
                    />
                    <Figure
                        label="Profit idle"
                        value={pkr(balances.profit_available)}
                    />
                    <Figure
                        label="Profit deployed"
                        value={pkr(balances.profit_deployed)}
                    />
                </dl>

                <dl className="grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-6">
                    <Figure
                        label="Available"
                        value={pkr(balances.available)}
                        strong
                        hint="Deployable or withdrawable now"
                    />
                    <Figure
                        label="Deployed"
                        value={pkr(balances.deployed)}
                    />
                    <Figure
                        label="Payable"
                        value={pkr(balances.payable)}
                        strong
                        hint="Owed if everything stopped today"
                    />
                    <Figure
                        label="Return"
                        value={`${balances.return_on_principal}%`}
                        hint="Profit over net principal"
                    />
                    <Figure
                        label="Turnover"
                        value={`${balances.capital_turnover}×`}
                        hint="Times their money was put to work"
                    />
                    <Figure
                        label="Growth"
                        value={`${balances.cumulative_growth}%`}
                        hint="How far their money has grown"
                    />
                </dl>
            </Card>

            {/* FR-IVT-11's cycles table is not built. Saying where the money
                goes beats an empty table. */}
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-muted" />
                <p className="text-sm text-muted">
                    <span className="font-medium text-foreground">
                        Capital is deployed by funding a contract.
                    </span>{" "}
                    Add this investor to the Funding panel when creating one,
                    and the deployed and profit figures above follow from what
                    that contract recovers. Idle profit can fund the next deal
                    with no separate step (BR-23). The per-cycle breakdown is
                    not built yet.
                </p>
            </div>

            <div className="mb-6">
                <MovementPanel
                    investorId={investor.id}
                    profitAvailable={pkr(balances.profit_available)}
                    principalAvailable={pkr(balances.principal_available)}
                />
            </div>

            <Card className="overflow-x-auto">
                <CardHeader
                    title="Ledger"
                    description="Append-only. A mistake is corrected with an adjustment, never by editing a line."
                />
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Bucket</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Amount
                            </th>
                            <th className="px-4 py-3 font-medium">Method</th>
                            <th className="px-4 py-3 font-medium">
                                Reference / reason
                            </th>
                            <th className="px-4 py-3 font-medium">By</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {transactions.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-12 text-center text-sm text-muted"
                                >
                                    Nothing recorded yet. Start with a deposit.
                                </td>
                            </tr>
                        ) : (
                            transactions.map((txn) => {
                                const negative = Number(txn.amount) < 0;

                                return (
                                    <tr
                                        key={txn.id}
                                        className="align-middle text-foreground"
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                            {formatDate(txn.txn_date)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge tone={TXN_TONE[txn.type]}>
                                                {txn.type}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted">
                                            {txn.bucket}
                                        </td>
                                        <td
                                            className={`px-4 py-3 text-right font-medium tabular-nums ${
                                                negative ? "text-negative" : ""
                                            }`}
                                        >
                                            {txn.type === "Withdrawal"
                                                ? `− ${pkr(txn.amount)}`
                                                : pkr(txn.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted">
                                            {txn.method ?? "—"}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {txn.reason ?? txn.reference ?? "—"}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted">
                                            {txn.entered_by_name}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </Card>
        </PageContainer>
    );
}
