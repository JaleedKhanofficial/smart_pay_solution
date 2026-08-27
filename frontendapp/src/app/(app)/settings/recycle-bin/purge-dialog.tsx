"use client";

import { useState, useTransition } from "react";
import { purgeRecord } from "./actions";
import { fieldClass, labelClass } from "@/components/form-fields";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { BinRow } from "@/types/recycle-bin";

type Props = {
    row: BinRow | null;
    onClose: () => void;
    onDone: (message: string) => void;
};

/** What the admin has to type. Short enough to type, specific enough to mean it. */
const PHRASE = "PURGE";

/**
 * FR-BIN-03. A typed confirmation, not a second Yes button.
 *
 * Everything else destructive in this system is recoverable — a delete moves a
 * record here, a void keeps the payment. This is the one action that is not,
 * so it asks for something a hurried click cannot produce.
 */
export function PurgeDialog({ row, onClose, onDone }: Props) {
    const [typed, setTyped] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const matches = typed.trim().toUpperCase() === PHRASE;

    function submit(event: React.FormEvent) {
        event.preventDefault();

        if (!row || !matches) return;

        setError(null);

        startTransition(async () => {
            const result = await purgeRecord(row.kind, row.id);

            if (result.ok) {
                onDone(result.message ?? "Purged.");
            } else {
                setError(result.message ?? "Could not purge this record.");
            }
        });
    }

    return (
        <Modal
            open={row !== null}
            onClose={onClose}
            title={row ? `Purge ${row.title}?` : "Purge"}
            description={row?.subtitle}
        >
            <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="flex items-start gap-3 rounded-md border border-negative/40 bg-negative/8 px-3 py-3">
                    <Icon
                        name="alert"
                        className="mt-0.5 size-4 shrink-0 text-negative"
                    />
                    <p className="text-sm text-foreground">
                        <span className="font-medium text-negative">
                            This cannot be undone.
                        </span>{" "}
                        <span className="text-muted">
                            The record is deleted from the database for good.
                            {row?.kind === "contract"
                                ? " Its installment schedule and every payment against it go with it."
                                : row?.kind === "customer"
                                  ? " Its guarantors go with it."
                                  : ""}{" "}
                            An audit entry recording the purge is kept.
                        </span>
                    </p>
                </div>

                <div>
                    <label className={labelClass} htmlFor="purge_confirm">
                        Type {PHRASE} to confirm
                    </label>
                    <input
                        id="purge_confirm"
                        type="text"
                        autoComplete="off"
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                        placeholder={PHRASE}
                        className={fieldClass}
                    />
                </div>

                {error ? (
                    <p className="rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative">
                        {error}
                    </p>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        stackOnMobile
                    >
                        Keep it
                    </Button>
                    <Button
                        type="submit"
                        variant="danger"
                        disabled={pending || !matches}
                        stackOnMobile
                    >
                        {pending ? "Purging…" : "Purge permanently"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
