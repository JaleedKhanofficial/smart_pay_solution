"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { Button } from "./button";

/**
 * SweetAlert-style dialogs, built natively — v1 loaded SweetAlert from a CDN
 * and NFR-10 rules those out at runtime.
 *
 * Promise-based, so a caller reads top to bottom:
 *
 *     if (!(await confirm({ title: "Delete this customer?" }))) return;
 */
export type DialogTone = "success" | "error" | "warning" | "question";

export type DialogOptions = {
    title: string;
    text?: string;
    tone?: DialogTone;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Confirm button turns red — use for anything destructive. */
    destructive?: boolean;
};

type OpenDialog = DialogOptions & {
    kind: "alert" | "confirm";
    resolve: (confirmed: boolean) => void;
};

type AlertContextValue = {
    /** Resolves true when confirmed, false on cancel, Escape or backdrop. */
    confirm: (options: DialogOptions) => Promise<boolean>;
    alert: (options: DialogOptions) => Promise<boolean>;
};

const AlertContext = createContext<AlertContextValue | null>(null);

const TONES: Record<DialogTone, { ring: string; colour: string }> = {
    success: { ring: "border-positive/30 bg-positive/10", colour: "text-positive" },
    error: { ring: "border-negative/30 bg-negative/10", colour: "text-negative" },
    warning: { ring: "border-brand/40 bg-brand/10", colour: "text-brand-ink" },
    question: { ring: "border-border bg-surface-muted", colour: "text-muted" },
};

/** Drawn here rather than via <Icon> so the strokes can animate on. */
function DialogGlyph({ tone }: { tone: DialogTone }) {
    const common = {
        viewBox: "0 0 52 52",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 3,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        className: "size-10",
    };

    if (tone === "success") {
        return (
            <svg {...common} aria-hidden="true">
                <path d="M14 27l8 8 16-16" />
            </svg>
        );
    }

    if (tone === "error") {
        return (
            <svg {...common} aria-hidden="true">
                <path d="M17 17l18 18M35 17L17 35" />
            </svg>
        );
    }

    if (tone === "warning") {
        return (
            <svg {...common} aria-hidden="true">
                <path d="M26 14v16" />
                <path d="M26 38h.02" />
            </svg>
        );
    }

    return (
        <svg {...common} aria-hidden="true">
            <path d="M20 20a6 6 0 1 1 8 5.7V30" />
            <path d="M26 38h.02" />
        </svg>
    );
}

export function AlertDialogProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<OpenDialog | null>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);

    const open = useCallback(
        (kind: "alert" | "confirm", options: DialogOptions) =>
            new Promise<boolean>((resolve) => {
                setDialog({ ...options, kind, resolve });
            }),
        []
    );

    const close = useCallback(
        (confirmed: boolean) => {
            setDialog((current) => {
                current?.resolve(confirmed);

                return null;
            });
        },
        []
    );

    // Escape cancels, and the confirm button takes focus so the keyboard path
    // is Enter to accept, Escape to dismiss.
    useEffect(() => {
        if (!dialog) return;

        confirmRef.current?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") close(false);
        }

        document.addEventListener("keydown", onKeyDown);

        return () => document.removeEventListener("keydown", onKeyDown);
    }, [dialog, close]);

    const value = useMemo<AlertContextValue>(
        () => ({
            confirm: (options) => open("confirm", options),
            alert: (options) => open("alert", options),
        }),
        [open]
    );

    const tone = TONES[dialog?.tone ?? "question"];

    return (
        <AlertContext value={value}>
            {children}

            {dialog ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => close(false)}
                        className="sps-backdrop absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                    />

                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="sps-dialog-title"
                        aria-describedby={
                            dialog.text ? "sps-dialog-text" : undefined
                        }
                        className="sps-dialog relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl"
                    >
                        <span
                            className={`sps-dialog-icon mx-auto mb-4 grid size-16 place-items-center rounded-full border-4 ${tone.ring} ${tone.colour}`}
                        >
                            <DialogGlyph tone={dialog.tone ?? "question"} />
                        </span>

                        <h2
                            id="sps-dialog-title"
                            className="text-lg font-semibold text-foreground"
                        >
                            {dialog.title}
                        </h2>

                        {dialog.text ? (
                            <p
                                id="sps-dialog-text"
                                className="mt-2 text-sm text-muted"
                            >
                                {dialog.text}
                            </p>
                        ) : null}

                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                            {dialog.kind === "confirm" ? (
                                <Button
                                    variant="secondary"
                                    onClick={() => close(false)}
                                    stackOnMobile
                                >
                                    {dialog.cancelLabel ?? "Cancel"}
                                </Button>
                            ) : null}

                            <Button
                                ref={confirmRef}
                                variant={
                                    dialog.destructive ? "danger" : "primary"
                                }
                                onClick={() => close(true)}
                                stackOnMobile
                            >
                                {dialog.confirmLabel ??
                                    (dialog.kind === "confirm" ? "Yes" : "OK")}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </AlertContext>
    );
}

export function useAlert(): AlertContextValue {
    const context = useContext(AlertContext);

    if (!context) {
        throw new Error("useAlert must be used inside an AlertDialogProvider");
    }

    return context;
}
