import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestorActions } from "./investor-actions";
import { MovementPanel } from "./movement-panel";
import { ApiError } from "@/api/api.repository";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { BUCKET_LABEL, type InvestorDetail, type TxnType } from "@/types/investor";
import type { BusinessIdentity, Setting } from "@/types/setting";

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

/**
 * How a band's three cards lay out as the screen grows.
 *
 * **money** — one per row on a phone. Two abreast leaves about 130px of card,
 * and `Rs. 184,000` at this size wraps onto a second line in that space, which
 * is what a figure must never do. Two from `sm`, three from `md`, and the tile
 * itself steps the figure up a size at `lg` once there is room.
 *
 * **ratio** — two abreast on a phone, three from `sm`. `84.00%` has no space
 * in it to wrap at, so a card too narrow for it clips the figure rather than
 * running on: three abreast leaves 56px of card on a 320px screen and the
 * number does not fit. Two does, and a lone third card below them is only
 * untidy. Full width would be a whole screen spent on three short numbers.
 *
 * The sidebar takes no width until `lg`, so `md` has the entire 768px — three
 * money cards are 229px there, and the figure fits with room to spare.
 */
const BAND_COLUMNS = {
    money: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    ratio: "grid-cols-2 sm:grid-cols-3",
} as const;

/** A row of cards under a quiet heading, so the grouping survives. */
function Band({
    title,
    note,
    columns = "money",
    children,
}: {
    title: string;
    note?: string;
    columns?: keyof typeof BAND_COLUMNS;
    children: React.ReactNode;
}) {
    return (
        <section className="mb-6">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {title}
                </h2>
                {note ? <p className="text-xs text-muted">{note}</p> : null}
            </div>
            <div className={`grid gap-3 sm:gap-4 ${BAND_COLUMNS[columns]}`}>
                {children}
            </div>
        </section>
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

    /**
     * The letterhead for the statement. `/settings` answers with the whole
     * registry, so the one entry is picked out here rather than adding a route
     * for it — the same read the funding register does.
     *
     * A failed read costs the name on the header and nothing else: the page
     * still renders and the statement still downloads, under the default name.
     */
    const business = await apiCall<Setting[]>("/settings")
        .then(
            (settings) =>
                settings.find((entry) => entry.key === "business_identity")
                    ?.value as BusinessIdentity | undefined
        )
        .catch(() => undefined);

    const { balances, transactions } = investor;

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 13"
                title={investor.full_name}
                description={`${investor.cnic_number}  |  ${investor.mobile_number}${investor.agreement_date ? `  |  agreed ${formatDate(investor.agreement_date)}` : ""}`}
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
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
                        <InvestorActions
                            investor={investor}
                            businessName={business?.name ?? "SmartPay Solutions"}
                        />
                    </div>
                }
            />

            {/*
                FR-IVT-09. Four bands rather than one dense card: these are the
                figures the whole page exists to show, and a heading over each
                keeps capital, profit and the position apart while every figure
                still reads as one tile.
            */}
            <Band
                title="Position"
                note="Derived from the ledger below — nothing here is stored."
            >
                <StatTile
                    label="Available"
                    value={pkr(balances.available)}
                    hint="Deployable or withdrawable now"
                />
                <StatTile
                    label="Deployed"
                    value={pkr(balances.deployed)}
                    hint="Out in contracts"
                />
                <StatTile
                    label="Payable"
                    value={pkr(balances.payable)}
                    hint="Owed if everything stopped today"
                />
            </Band>

            <Band title="Capital">
                <StatTile
                    label="Net capital"
                    value={pkr(balances.net_principal)}
                    hint="Deposited, less withdrawn and adjusted"
                />
                <StatTile
                    label="Capital idle"
                    value={pkr(balances.principal_available)}
                    hint="Waiting for a deal"
                />
                <StatTile
                    label="Capital deployed"
                    value={pkr(balances.principal_deployed)}
                    hint="Bought a contract and not yet back"
                />
            </Band>

            <Band title="Profit">
                <StatTile
                    label="Profit earned"
                    value={pkr(balances.lifetime_profit)}
                    hint="Lifetime, even once withdrawn"
                />
                <StatTile
                    label="Profit idle"
                    value={pkr(balances.profit_available)}
                    hint="Withdrawable, or it can fund the next deal (BR-23)"
                />
                <StatTile
                    label="Profit deployed"
                    value={pkr(balances.profit_deployed)}
                    hint="Reinvested and still out"
                />
            </Band>

            <Band title="Performance" columns="ratio">
                <StatTile
                    label="Return"
                    value={`${balances.return_on_principal}%`}
                    hint="Of net capital"
                />
                <StatTile
                    label="Turnover"
                    value={`${balances.capital_turnover}×`}
                    hint="Times put to work"
                />
                <StatTile
                    label="Growth"
                    value={`${balances.cumulative_growth}%`}
                    hint="On the money put in"
                />
            </Band>

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
                                            {BUCKET_LABEL[txn.bucket]}
                                        </td>
                                        <td
                                            className={`px-4 py-3 text-right font-medium tabular-nums ${
                                                negative || txn.type === "Loss"
                                                    ? "text-negative"
                                                    : ""
                                            }`}
                                        >
                                            {/* A Loss is stored positive and
                                                subtracted (BR-21), so it is
                                                shown the way it reads on the
                                                balance, not the way it is
                                                stored. */}
                                            {txn.type === "Withdrawal" ||
                                            txn.type === "Loss"
                                                ? `− ${pkr(txn.amount)}`
                                                : pkr(txn.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted">
                                            {txn.method ?? "—"}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {/* A Loss names its contract; once
                                                that contract is purged the
                                                reference is gone and only the
                                                reason survives (BR-20). */}
                                            {txn.contract_id !== null ? (
                                                <a
                                                    href={`/contracts/${txn.contract_id}/ledger`}
                                                    className="text-foreground hover:underline"
                                                >
                                                    Contract #{txn.contract_id}
                                                </a>
                                            ) : null}
                                            {txn.contract_id !== null &&
                                            (txn.reason ?? txn.reference)
                                                ? " · "
                                                : ""}
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
