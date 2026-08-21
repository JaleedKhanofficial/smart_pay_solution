"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "../icons";

/**
 * The application's popup. `AlertDialog` next door answers a question and
 * closes; this one holds a form, so it is wider, scrolls its own body, and
 * never closes by accident.
 *
 * Sizes are the same three the page container uses, for the same reason: a
 * form field stretched across a wide panel is harder to fill in, not easier.
 */
const SIZES = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
} as const;

export type ModalSize = keyof typeof SIZES;

type Props = {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    size?: ModalSize;
    /**
     * Leave false for anything with unsaved input: a stray backdrop click
     * should not discard what the user typed.
     */
    dismissOnBackdrop?: boolean;
    children: ReactNode;
    /** Rendered in the footer strip; the modal supplies no buttons of its own. */
    footer?: ReactNode;
};

export function Modal({
    open,
    onClose,
    title,
    description,
    size = "md",
    dismissOnBackdrop = false,
    children,
    footer,
}: Props) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!open) return;

        const panel = panelRef.current;
        // Whatever opened the modal, so focus can go back to it on close.
        const opener = document.activeElement as HTMLElement | null;

        // Focus the first real control rather than the panel, so a keyboard
        // user lands in the form instead of having to tab into it.
        const focusable = () =>
            Array.from(
                panel?.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                ) ?? []
            ).filter((node) => node.offsetParent !== null);

        focusable()[0]?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();

                return;
            }

            if (event.key !== "Tab") return;

            // Trap Tab inside the panel: without this, focus walks out into the
            // page behind, which a screen reader then reads as if it were live.
            const nodes = focusable();

            if (nodes.length === 0) return;

            const first = nodes[0];
            const last = nodes[nodes.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener("keydown", onKeyDown);

        // The page behind must not scroll under the panel.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
            opener?.focus();
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button
                type="button"
                aria-label="Close"
                tabIndex={-1}
                onClick={dismissOnBackdrop ? onClose : undefined}
                className="sps-backdrop absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                /* Full-width sheet on a phone, centred panel from sm up. */
                className={`sps-dialog relative flex max-h-[92dvh] w-full ${SIZES[size]} flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl`}
            >
                <div className="flex items-start gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
                    <div className="min-w-0 flex-1">
                        <h2
                            id={titleId}
                            className="truncate text-base font-semibold text-foreground"
                        >
                            {title}
                        </h2>
                        {description ? (
                            <p
                                id={descriptionId}
                                className="mt-0.5 text-xs text-muted"
                            >
                                {description}
                            </p>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        title="Close"
                        className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                        <Icon name="close" className="size-4" />
                    </button>
                </div>

                {/* Only the body scrolls, so the title and actions stay put. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                    {children}
                </div>

                {footer ? (
                    <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
                        {footer}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
