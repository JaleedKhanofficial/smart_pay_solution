"use client";

import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import type { ClientProfile, ScoreBand } from "@/types/report";

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

const BAND_TONE: Record<ScoreBand, BadgeTone> = {
    green: "positive",
    gold: "accent",
    red: "negative",
};

const BAND_STROKE: Record<ScoreBand, string> = {
    green: "var(--positive)",
    gold: "var(--brand)",
    red: "var(--negative)",
};

/**
 * BR-11's score as a ring. An SVG rather than a chart library: it is one arc
 * whose length is the score, and a dependency for that would be absurd.
 */
function ScoreRing({ score, band }: { score: string; band: ScoreBand }) {
    const value = Math.max(0, Math.min(100, Number(score)));
    const radius = 34;
    const circumference = 2 * Math.PI * radius;

    return (
        <svg viewBox="0 0 80 80" className="size-20" role="img" aria-label={`Score ${score}`}>
            <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth="7"
            />
            <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke={BAND_STROKE[band]}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
                // Start the arc at twelve o'clock rather than three.
                transform="rotate(-90 40 40)"
            />
            <text
                x="40"
                y="45"
                textAnchor="middle"
                className="fill-foreground text-[15px] font-semibold"
            >
                {Math.round(value)}
            </text>
        </svg>
    );
}

function Kpi({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {label}
            </dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">
                {value}
            </dd>
        </div>
    );
}

/** FR-SUM-07. The per-client profile: KPI strip, score ring, deal breakdown. */
export function ClientProfileModal({
    profile,
    onClose,
}: {
    profile: ClientProfile | null;
    onClose: () => void;
}) {
    return (
        <Modal
            open={profile !== null}
            onClose={onClose}
            title={profile?.customer_name ?? "Client"}
            description={
                profile
                    ? `${profile.customer_cnic} · ${profile.customer_mobile}`
                    : undefined
            }
        >
            {profile ? (
                <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-5">
                        <ScoreRing
                            score={profile.score}
                            band={profile.band}
                        />
                        <div className="min-w-0">
                            <Badge tone={BAND_TONE[profile.band]}>
                                {profile.band === "green"
                                    ? "Strong"
                                    : profile.band === "gold"
                                      ? "Fair"
                                      : "Needs attention"}
                            </Badge>
                            <p className="mt-2 text-xs text-muted">
                                BR-11, weighted by each deal&apos;s written
                                value — so a large plan running late is not
                                offset by a small one paid perfectly.
                            </p>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-3">
                        <Kpi
                            label="Deals"
                            value={`${profile.deals} (${profile.completed} done)`}
                        />
                        <Kpi label="Written" value={pkr(profile.total_sale)} />
                        <Kpi label="Paid" value={pkr(profile.total_paid)} />
                        <Kpi
                            label="Outstanding"
                            value={pkr(profile.total_outstanding)}
                        />
                        <Kpi
                            label="Mature profit"
                            value={pkr(profile.mature_profit)}
                        />
                        <Kpi
                            label="Unmatured"
                            value={pkr(profile.unmatured_profit)}
                        />
                    </dl>

                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            Deals
                        </p>
                        <ul className="flex flex-col gap-2">
                            {profile.deals_detail.map((deal) => (
                                <li
                                    key={deal.contract_id}
                                    className="rounded-md border border-border px-3 py-2"
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <Link
                                            href={`/contracts/${deal.contract_id}/ledger`}
                                            className="truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                                        >
                                            {deal.product_name}
                                        </Link>
                                        <Badge tone={BAND_TONE[deal.band]}>
                                            {deal.score}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted">
                                        {deal.deal_type} ·{" "}
                                        {formatDate(deal.start_date)} ·{" "}
                                        {deal.plan_months} months
                                    </p>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                                        <div
                                            className="h-full rounded-full bg-positive"
                                            style={{
                                                width: `${deal.pct_completed}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-1 flex justify-between text-[11px] tabular-nums text-muted">
                                        <span>
                                            {pkr(deal.paid)} of{" "}
                                            {pkr(deal.rem_balance)}
                                        </span>
                                        <span>{deal.pct_completed}%</span>
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}
