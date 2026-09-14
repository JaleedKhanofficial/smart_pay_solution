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

type Props = {
    label: string;
    value: string;
    hint?: string;
    /** Marks a figure the API cannot supply yet. */
    pending?: boolean;
    tone?: StatTone;
    icon?: IconName;
};

export function StatTile({
    label,
    value,
    hint,
    pending,
    tone = "neutral",
    icon,
}: Props) {
    const { card, bar, chip, ink } = TONES[tone];

    return (
        <div className={`relative flex flex-col overflow-hidden p-4 ${card}`}>
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
                className={`mt-3 text-xl font-semibold tracking-tight tabular-nums lg:text-2xl ${
                    pending ? "text-muted/50" : "text-foreground"
                }`}
            >
                {value}
            </p>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
    );
}
