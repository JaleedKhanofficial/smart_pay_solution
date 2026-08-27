"use client";

import { useState, useTransition } from "react";
import { addEntry, removeEntry } from "./actions";
import { TextField } from "@/components/form-fields";
import { Icon } from "@/components/icons";
import { useAlert } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Entry } from "@/types/report";

type Props = {
    kind: "capital" | "expenses";
    title: string;
    description: string;
    total: string;
    entries: Entry[];
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/** This month, as `2026-08` — the period a new entry usually belongs to. */
function thisPeriod(): string {
    return new Date().toISOString().slice(0, 7);
}

/** FR-SUM-02-v2. Both panels are the same shape, so they are one component. */
export function EntriesPanel({
    kind,
    title,
    description,
    total,
    entries,
}: Props) {
    const { confirm, alert } = useAlert();
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [period, setPeriod] = useState(thisPeriod());
    const [note, setNote] = useState("");
    const [pending, startTransition] = useTransition();

    function report(result: { ok: boolean; message: string | null }) {
        void alert(
            result.ok
                ? { title: result.message ?? "Saved", tone: "success" }
                : {
                      title: "That could not be saved",
                      text: result.message ?? undefined,
                      tone: "error",
                  }
        );
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();

        startTransition(async () => {
            const result = await addEntry(
                kind,
                Number(amount),
                period,
                note
            );

            if (result.ok) {
                setAmount("");
                setNote("");
                setOpen(false);
            }

            report(result);
        });
    }

    async function remove(entry: Entry) {
        const confirmed = await confirm({
            title: `Remove ${pkr(entry.amount)}?`,
            text: "The net balance is recalculated without it.",
            tone: "warning",
            confirmLabel: "Remove",
            destructive: true,
        });

        if (!confirmed) return;

        startTransition(async () => {
            report(await removeEntry(kind, entry.id));
        });
    }

    return (
        <Card>
            <CardHeader
                title={title}
                description={description}
                actions={
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                        {pkr(total)}
                    </span>
                }
            />

            {entries.length > 0 ? (
                <ul className="divide-y divide-border">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className="flex items-center gap-3 px-4 py-2 sm:px-5"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-foreground">
                                    {entry.note || "No note"}
                                </p>
                                <p className="text-xs text-muted">
                                    {entry.period_label} ·{" "}
                                    {entry.entered_by_name} ·{" "}
                                    {formatDate(entry.created_at)}
                                </p>
                            </div>
                            <span className="shrink-0 text-sm tabular-nums text-foreground">
                                {pkr(entry.amount)}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => remove(entry)}
                                disabled={pending}
                                iconOnly
                                aria-label="Remove entry"
                                title="Remove"
                            >
                                <Icon name="trash" className="size-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="px-4 py-6 text-center text-sm text-muted sm:px-5">
                    Nothing recorded yet.
                </p>
            )}

            <div className="border-t border-border px-4 py-3 sm:px-5">
                {open ? (
                    <form onSubmit={submit} className="flex flex-col gap-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <TextField
                                label="Amount (Rs.)"
                                name={`${kind}_amount`}
                                type="number"
                                min={0.01}
                                step="0.01"
                                required
                                value={amount}
                                onChange={(event) =>
                                    setAmount(event.target.value)
                                }
                            />
                            <TextField
                                label="Period"
                                name={`${kind}_period`}
                                required
                                maxLength={20}
                                value={period}
                                onChange={(event) =>
                                    setPeriod(event.target.value)
                                }
                                hint="e.g. 2026-08"
                            />
                            <TextField
                                label="Note"
                                name={`${kind}_note`}
                                maxLength={500}
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder={
                                    kind === "capital"
                                        ? "Opening capital"
                                        : "Shop rent"
                                }
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={pending || amount === ""}
                            >
                                {pending ? "Saving…" : "Record"}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpen(true)}
                    >
                        <Icon name="plus" className="size-4" />
                        Record {kind === "capital" ? "capital" : "an expense"}
                    </Button>
                )}
            </div>
        </Card>
    );
}
