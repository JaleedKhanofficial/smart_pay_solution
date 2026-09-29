import Link from "next/link";
import { Icon, type IconName } from "./icons";
import { Badge } from "./ui/badge";
import { CARD_CLASS } from "./ui/card";

/**
 * Tile accents. `neutral` is the original plain tile, so every screen that
 * passes no tone looks exactly as it did.
 *
 * Each tone is one colour used three ways — a hairline along the top, a tinted
 * icon chip, and the label — over a wash faint enough that the figure keeps
 * full contrast against it. The classes are spelled out rather than composed
 * because Tailwind only emits what it can find literally in the source, and
 * they replace the card's own border/background instead of fighting it.
 */
export type StatTone =
    | "neutral"
    | "brand"
    | "positive"
    | "negative"
    | "warning"
    | "violet"
    | "navy";

type ToneStyle = { card: string; bar: string; chip: string; ink: string };

const TONES: Record<StatTone, ToneStyle> = {
    neutral: {
        card: CARD_CLASS,
        bar: "",
        chip: "bg-surface-muted text-muted",
        ink: "text-foreground",
    },
    brand: {
        card: "rounded-xl border border-brand-ink/25 bg-brand-ink/6",
        bar: "bg-brand-ink",
        chip: "bg-brand-ink/12 text-brand-ink",
        ink: "text-brand-ink",
    },
    positive: {
        card: "rounded-xl border border-positive/25 bg-positive/6",
        bar: "bg-positive",
        chip: "bg-positive/12 text-positive",
        ink: "text-positive",
    },
    negative: {
        card: "rounded-xl border border-negative/25 bg-negative/6",
        bar: "bg-negative",
        chip: "bg-negative/12 text-negative",
        ink: "text-negative",
    },
    warning: {
        card: "rounded-xl border border-warning/25 bg-warning/6",
        bar: "bg-warning",
        chip: "bg-warning/12 text-warning",
        ink: "text-warning",
    },
    violet: {
        card: "rounded-xl border border-violet/25 bg-violet/6",
        bar: "bg-violet",
        chip: "bg-violet/12 text-violet",
        ink: "text-violet",
    },
    navy: {
        card: "rounded-xl border border-chrome-700/25 bg-chrome-700/6",
        bar: "bg-chrome-700",
        chip: "bg-chrome-700/12 text-chrome-700",
        ink: "text-chrome-700",
    },
};

/**
 * A change against an earlier period, shown as an arrow and a figure beside
 * the value. `value` is a percentage or a plain count; `good` says which
 * direction is welcome, since a rising outstanding balance is not the same
 * news as rising collections. Null `value` means nothing to compare with —
 * the chip is skipped rather than showing 0%.
 */
export type StatDelta = {
    value: number | null;
    /**
     * "%" for a rate of change, "" for a raw difference, "pts" for a move in
     * a percentage — 37% to 41% is 4 points, not 11%.
     */
    unit?: "%" | "" | "pts";
    /** Shown instead of the figure — "new" when there was nothing before. */
    text?: string;
    good?: "up" | "down";
    /** Read on hover: "vs the same days last month". */
    title?: string;
};

/**
 * FR-DSH-20. A percentage read under the value: "71% on time · 14 of 84
 * installments due", with its own arrow for the move in points. `pct` null
 * means nothing was measured, and the line says so rather than showing 0%.
 */
export type StatRate = {
    pct: string | null;
    /** What the percentage is: "on time", "recovered", "past due". */
    label: string;
    /** The two numbers behind it: "14 of 84 installments due". */
    of: string;
    delta?: StatDelta;
};

type Props = {
    label: string;
    value: string;
    hint?: string;
    delta?: StatDelta;
    rate?: StatRate;
    /** Marks a figure the API cannot supply yet. */
    pending?: boolean;
    tone?: StatTone;
    icon?: IconName;
    /**
     * Where the figure came from. Given one, the whole tile becomes the link —
     * a number on a dashboard invites a click, and a small link tucked in a
     * corner is a worse target than the card already sitting under the cursor.
     */
    href?: string;
};

/**
 * The arrow and figure. Colour follows whether the move is welcome, and the
 * arrow carries the direction on its own — a red ▲ on outstanding and a red
 * ▼ on collections both read as bad news without the colour.
 */
function DeltaChip({ delta }: { delta: StatDelta }) {
    const value = delta.value ?? 0;
    const flat = Math.abs(value) < 0.05;
    const up = value > 0;
    const welcome = flat ? null : (delta.good ?? "up") === (up ? "up" : "down");
    const unit = delta.unit ?? "%";
    const figure = delta.text
        ? delta.text
        : unit === "pts"
          ? `${Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%`
          : unit === "%"
            ? `${Math.abs(value) >= 1000 ? ">999" : Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%`
            : String(Math.abs(Math.round(value)));

    return (
        <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                flat
                    ? "text-muted"
                    : welcome
                      ? "text-positive"
                      : "text-negative"
            }`}
            title={delta.title}
        >
            <span aria-hidden>{flat ? "▬" : up ? "▲" : "▼"}</span>
            <span className="sr-only">
                {flat ? "no change" : up ? "up" : "down"}
            </span>
            {figure}
        </span>
    );
}

export function StatTile({
    label,
    value,
    hint,
    pending,
    tone = "neutral",
    icon,
    href,
    delta,
    rate,
}: Props) {
    const { card, bar, chip, ink } = TONES[tone];

    // Lifts on hover and takes a focus ring, so it reads as something to press
    // and can be reached from the keyboard. Without a href nothing is added,
    // and every tile that had none looks exactly as it did.
    const interactive = href
        ? " transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        : "";

    const className = `relative flex flex-col overflow-hidden p-4 ${card}${interactive}`;

    const body = (
        <>
            {bar ? (
                <span
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-0.5 ${bar}`}
                />
            ) : null}

            <div className="flex items-start justify-between gap-2">
                <p
                    className={`text-xs font-medium uppercase tracking-wide ${ink}`}
                >
                    {label}
                </p>
                {pending ? (
                    <Badge tone="accent">Pending</Badge>
                ) : icon ? (
                    <span
                        className={`grid size-7 shrink-0 place-items-center rounded-md ${chip}`}
                    >
                        <Icon name={icon} className="size-4" />
                    </span>
                ) : null}
            </div>
            <p
                // Three tiles abreast on a narrow tablet leave roughly 190px
                // each; the figure steps up only once there is room for it.
                className={`mt-3 flex flex-wrap items-baseline gap-x-2 text-xl font-semibold tracking-tight tabular-nums lg:text-2xl ${
                    pending ? "text-muted/50" : "text-foreground"
                }`}
            >
                {value}
                {delta && delta.value !== null ? (
                    <DeltaChip delta={delta} />
                ) : null}
            </p>
            {rate ? (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xs">
                    {rate.pct === null ? (
                        <span className="text-muted">
                            Nothing {rate.of} yet
                        </span>
                    ) : (
                        <>
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                                {Math.round(Number(rate.pct))}%
                            </span>
                            <span className="text-muted">{rate.label}</span>
                            {rate.delta && rate.delta.value !== null ? (
                                <DeltaChip delta={rate.delta} />
                            ) : null}
                            <span className="w-full font-mono text-[11px] text-muted">
                                {rate.of}
                            </span>
                        </>
                    )}
                </p>
            ) : null}
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </>
    );

    // Branched rather than picking the element into a variable: a component
    // type that is `Link | "div"` cannot narrow `href`, and TypeScript is
    // right to object — a div has no href to give.
    return href ? (
        <Link href={href} className={className}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}
