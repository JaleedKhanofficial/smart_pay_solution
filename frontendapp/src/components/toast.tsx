"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { Icon } from "./icons";

export type ToastTone = "success" | "error";

type Toast = {
    id: number;
    message: string;
    tone: ToastTone;
};

type ToastContextValue = {
    push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_AFTER_MS = 5000;

/** FR-CUS-10 / NFR-01: every write is confirmed with a toast. */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback(
        (message: string, tone: ToastTone = "success") => {
            // Date.now() is only an id here; collisions do not matter beyond
            // the key, and the counter keeps rapid pushes distinct.
            const id = nextId();

            setToasts((current) => [...current, { id, message, tone }]);

            setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
        },
        [dismiss]
    );

    const value = useMemo(() => ({ push }), [push]);

    return (
        <ToastContext value={value}>
            {children}

            <div
                aria-live="polite"
                className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role="status"
                        className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
                            toast.tone === "error"
                                ? "border-negative/40 bg-surface text-negative"
                                : "border-positive/40 bg-surface text-positive"
                        }`}
                    >
                        <span className="mt-0.5 shrink-0">
                            <Icon
                                name={
                                    toast.tone === "error" ? "alert" : "shield"
                                }
                                className="size-4"
                            />
                        </span>
                        <span className="flex-1 text-foreground">
                            {toast.message}
                        </span>
                        <button
                            type="button"
                            onClick={() => dismiss(toast.id)}
                            aria-label="Dismiss"
                            className="shrink-0 text-muted transition-colors hover:text-foreground"
                        >
                            <Icon name="close" className="size-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext>
    );
}

let counter = 0;

function nextId(): number {
    counter += 1;

    return counter;
}

export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useToast must be used inside a ToastProvider");
    }

    return context;
}
