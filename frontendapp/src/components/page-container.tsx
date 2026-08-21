import type { ReactNode } from "react";

/**
 * The one place page width is decided (NFR-14.3 — screens should not carry
 * their own layout constants). Changing how much of the screen the application
 * uses is editing this file and nothing else.
 *
 * `wide` is for registers and dashboards: the table fills the screen, capped
 * only so a row does not become unreadably long on an ultrawide monitor.
 *
 * `narrow` is for forms, deliberately. A text input stretched across 1800px is
 * harder to fill in, not easier, and the eye loses the label it belongs to.
 */
const WIDTHS = {
    wide: "max-w-[1800px]",
    narrow: "max-w-5xl",
    /** Short messages — errors, empty pages — that should not sprawl. */
    prose: "max-w-2xl",
} as const;

export type PageWidth = keyof typeof WIDTHS;

type Props = {
    children: ReactNode;
    width?: PageWidth;
    className?: string;
};

export function PageContainer({
    children,
    width = "wide",
    className = "",
}: Props) {
    return (
        <div
            className={`mx-auto w-full ${WIDTHS[width]} px-4 py-8 sm:px-6 lg:px-8 ${className}`}
        >
            {children}
        </div>
    );
}
