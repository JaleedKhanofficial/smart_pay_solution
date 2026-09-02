"use client";

import { useEffect, useState, useTransition } from "react";
import { loadContractRestorePreview, restoreRecord } from "./actions";
import { SelectField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDateTime } from "@/lib/format";
import type { BinRow } from "@/types/recycle-bin";

type Props = {
    row: BinRow | null;
    onClose: () => void;
    onDone: (message: string) => void;
};

type LoadState = "idle" | "loading" | "funded" | "unfunded";

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string | number): string {
    const amount = Number(value);

    return `Rs. ${money.format(Number.isFinite(amount) ? amount : 0)}`;
}

/**
 * FR-BIN-02. A funded contract cannot simply reappear — the admin chooses who
 * carries each stake forward before it leaves the bin.
 */
export function RestoreContractDialog({ row, onClose, onDone }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [loadState, setLoadState] = useState<LoadState>("idle");

    const contractId = row?.kind === "contract" ? row.id : null;

    const [preview, setPreview] = useState<{
        id: number;
        captured_at: string | null;
        fundings: Array<{
            investor_id: number;
            investor_name: string;
            amount: string;
            share_pct: string;
        }>;
        investors: Array<{ id: number; full_name: string; available: string }>;
    } | null>(null);

    const [choices, setChoices] = useState<string[]>([]);

    useEffect(() => {
        if (contractId === null) {
            setLoadState("idle");
            setPreview(null);
            setChoices([]);
            return;
        }

        setLoadState("loading");
        setPreview(null);
        setChoices([]);
        setError(null);

        void loadContractRestorePreview(contractId).then((data) => {
            if (contractId !== row?.id) return;

            if (!data || data.fundings.length === 0) {
                setLoadState("unfunded");
                return;
            }

            setPreview({
                id: contractId,
                captured_at: data.captured_at,
                fundings: data.fundings,
                investors: data.investors,
            });
            setChoices(
                data.fundings.map((line) => String(line.investor_id))
            );
            setLoadState("funded");
        });
    }, [contractId, row?.id]);

    const loaded =
        preview !== null &&
        contractId !== null &&
        preview.id === contractId &&
        loadState === "funded";

    const investorOptions = loaded
        ? [
              { value: "", label: "Select an investor…" },
              ...preview.investors.map((investor) => ({
                  value: String(investor.id),
                  label: `${investor.full_name} — ${pkr(investor.available)} available`,
              })),
          ]
        : [];

    const ready =
        loadState === "unfunded" ||
        (loaded &&
            choices.length === preview.fundings.length &&
            choices.every((value) => value !== ""));

    function submit(event: React.FormEvent) {
        event.preventDefault();

        if (!row || !ready) return;

        setError(null);

        startTransition(async () => {
            const result = await restoreRecord(
                row.kind,
                row.id,
                loadState === "funded"
                    ? {
                          fundings: choices.map((value) => ({
                              investor_id: Number(value),
                          })),
                      }
                    : undefined
            );

            if (result.ok) {
                onDone(result.message ?? "Restored.");
            } else {
                setError(result.message ?? "Could not restore this contract.");
            }
        });
    }

    return (
        <Modal
            open={row !== null}
            onClose={onClose}
            title={row ? `Restore ${row.title}?` : "Restore contract"}
            description={row?.subtitle}
        >
            <form onSubmit={submit} className="flex flex-col gap-4">
                {loadState === "funded" ? (
                    <p className="text-sm text-muted">
                        This contract was investor-funded when it was deleted.
                        Choose which investor should carry each stake forward
                        before it returns to service.
                    </p>
                ) : loadState === "unfunded" ? (
                    <p className="text-sm text-muted">
                        This contract had no investor funding. It will return
                        to service as-is.
                    </p>
                ) : null}

                {loadState === "loading" ? (
                    <p className="text-sm text-muted">Loading funding…</p>
                ) : null}

                {loaded ? (
                    <div className="flex flex-col gap-4">
                        {preview.captured_at ? (
                            <p className="text-xs text-muted">
                                Amounts recorded when deleted:{" "}
                                {formatDateTime(preview.captured_at)}
                            </p>
                        ) : null}

                        {preview.fundings.map((line, index) => (
                            <div
                                key={`${line.investor_id}-${index}`}
                                className="rounded-md border border-border p-3"
                            >
                                <p className="text-sm font-medium text-foreground">
                                    {pkr(line.amount)}{" "}
                                    <span className="font-normal text-muted">
                                        ({line.share_pct}% stake)
                                    </span>
                                </p>
                                <p className="mt-0.5 text-xs text-muted">
                                    Was funded by {line.investor_name}
                                </p>

                                <div className="mt-3">
                                    <SelectField
                                        label="Forward this deal to"
                                        name={`restore_investor_${index}`}
                                        value={choices[index] ?? ""}
                                        onChange={(event) =>
                                            setChoices((current) => {
                                                const next = [...current];
                                                next[index] =
                                                    event.target.value;
                                                return next;
                                            })
                                        }
                                        options={investorOptions}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

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
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={pending || loadState === "loading" || !ready}
                        stackOnMobile
                    >
                        {pending ? "Restoring…" : "Restore contract"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
