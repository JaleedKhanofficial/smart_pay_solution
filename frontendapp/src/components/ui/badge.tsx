import type { ReactNode } from "react";

/**
 * Small status pill. Tones are semantic, not decorative — `accent` marks
 * something provisional, the rest carry state (SRS NFR-01).
 */
export type BadgeTone =
    | "accent"
    | "neutral"
    | "positive"
    | "negative"
    | "solid";

const TONES: Record<BadgeTone, string> = {
    accent: "bg-brand/12 text-brand-ink",
    neutral: "bg-surface-muted text-muted",
    positive: "bg-positive/12 text-positive",
    negative: "bg-negative/12 text-negative",
    solid: "bg-chrome-800 text-white",
};

export function Badge({
    tone = "neutral",
    className = "",
    children,
}: {
    tone?: BadgeTone;
    className?: string;
    children: ReactNode;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONES[tone]} ${className}`.trim()}
        >
            {children}
        </span>
    );
}
