import Link from "next/link";
import type { Dashboard } from "@/types/dashboard";

type Scorecard = Dashboard["scorecards"][number];

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/** Initials for the avatar disc: "Amber Campbell" → "AC". */
function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

/**
 * One background per card, fixed by position so a name keeps its colour
 * across reloads. These are the same categorical slots the chart uses, so
 * an investor's disc here matches their line below.
 */
const DISC = [
    "bg-[#3987e5]",
    "bg-[#d95926]",
    "bg-[#199e70]",
    "bg-[#c98500]",
    "bg-[#d55181]",
    "bg-[#008300]",
    "bg-[#9085e9]",
    "bg-[#e66767]",
];

function Change({ now, before }: { now: string; before: string | null }) {
    if (before === null) return null;

    const a = Number(now);
    const b = Number(before);

    if (b === 0 && a === 0) return null;

    const pct = b === 0 ? null : ((a - b) / b) * 100;
    const up = a >= b;

    return (
        <span
            className={`ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                up ? "text-positive" : "text-negative"
            }`}
            title="vs the period before"
        >
            <span aria-hidden>{up ? "▲" : "▼"}</span>
            {pct === null ? "new" : `${Math.abs(pct).toFixed(0)}%`}
        </span>
    );
}

/**
 * FR-DSH-18. A card per investor: what their money is in and what it did.
 *
 * Each card is that investor's own dashboard in miniature — pick them in the
 * filter and the tiles say what the card said, with their card alone left
 * standing. Rows are label left, figure right, the way a statement reads.
 */
export function Scorecards({
    cards,
    periodic,
}: {
    cards: Scorecard[];
    periodic: boolean;
}) {
    if (cards.length === 0) return null;

    return (
        <section className="mb-6">
            <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {cards.length === 1 ? "Investor scorecard" : "Investor scorecards"}
                <span className="h-px flex-1 bg-border" aria-hidden />
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cards.map((card, i) => (
                    <Link
                        key={card.investor_id}
                        href={`/dashboard?investor=${card.investor_id}`}
                        className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-600"
                    >
                        <div className="flex items-center gap-3">
                            <span
                                aria-hidden
                                className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${DISC[i % DISC.length]}`}
                            >
                                {initials(card.investor_name)}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                    {card.investor_name}
                                </p>
                                <p className="truncate text-xs text-muted">
                                    {card.contracts} contract
                                    {card.contracts === 1 ? "" : "s"} ·{" "}
                                    {pkr(card.net_capital)} capital
                                    {card.status === "inactive"
                                        ? " · inactive"
                                        : ""}
                                </p>
                            </div>
                        </div>

                        <dl className="mt-4 space-y-1.5 text-sm">
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted">On-time payments</dt>
                                <dd className="tabular-nums text-foreground">
                                    {card.on_time.pct === null
                                        ? "—"
                                        : `${card.on_time.numerator}/${card.on_time.denominator} (${Math.round(Number(card.on_time.pct))}%)`}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted">Collection rate</dt>
                                <dd className="tabular-nums text-foreground">
                                    {card.collection.pct === null
                                        ? "—"
                                        : `${Math.round(Number(card.collection.pct))}%`}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted">
                                    {periodic ? "Collected" : "Collected all time"}
                                </dt>
                                <dd className="font-medium tabular-nums text-foreground">
                                    {pkr(card.collected)}
                                    <Change
                                        now={card.collected}
                                        before={card.collected_before}
                                    />
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted">Outstanding</dt>
                                <dd className="tabular-nums text-foreground">
                                    {pkr(card.outstanding)}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted">Mature profit</dt>
                                <dd className="font-medium tabular-nums text-positive">
                                    {pkr(card.mature_profit)}
                                </dd>
                            </div>
                        </dl>
                    </Link>
                ))}
            </div>
        </section>
    );
}
