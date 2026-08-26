"use client";

import { useState, useTransition } from "react";
import { cancelContract } from "./actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { fieldClass, labelClass } from "@/components/form-fields";
import type { Contract } from "@/types/contract";

type Props = {
    contract: Contract | null;
    onClose: () => void;
    onDone: (message: string) => void;
};

/**
 * FR-CON-08-v2. Cancelling is not a delete: the contract stays on the books and
 * keeps its payments. The API demands a reason, and demands `write_off` where a
 * balance remains — so the two are asked for together rather than the operator
 * meeting a 400 after the fact.
 *
 * A plain confirm() cannot carry a text field, which is why this is its own
 * dialog rather than a call to useAlert().
 */
export function CancelContractDialog({ contract, onClose, onDone }: Props) {
    const [reason, setReason] = useState("");
    const [writeOff, setWriteOff] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function submit(event: React.FormEvent) {
        event.preventDefault();

        if (!contract) return;

        setError(null);

        startTransition(async () => {
            const result = await cancelContract(
                contract.id,
                reason.trim(),
                writeOff
            );

            if (result.ok) {
                onDone(result.message ?? "Contract cancelled.");
            } else {
                setError(result.message ?? "Could not cancel this contract.");
            }
        });
    }

    return (
        <Modal
            open={contract !== null}
            onClose={onClose}
            title={
                contract
                    ? `Cancel contract #${contract.id}?`
                    : "Cancel contract"
            }
            description={
                contract
                    ? `${contract.customer_name} · ${contract.product_name}`
                    : undefined
            }
        >
            <form onSubmit={submit} className="flex flex-col gap-4">
                <p className="text-sm text-muted">
                    The contract stops accruing and stays in the register with
                    its payments intact. This is not a delete and cannot be
                    undone from here.
                </p>

                <div>
                    <label className={labelClass} htmlFor="cancel_reason">
                        Reason
                    </label>
                    <textarea
                        id="cancel_reason"
                        name="cancel_reason"
                        rows={3}
                        required
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Why is this contract being cancelled?"
                        className={fieldClass}
                    />
                </div>

                <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                    <input
                        type="checkbox"
                        checked={writeOff}
                        onChange={(event) => setWriteOff(event.target.checked)}
                        className="mt-0.5 size-4 accent-chrome-800"
                    />
                    <span>
                        <span className="font-medium text-foreground">
                            Write off the remaining balance
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                            Required when anything is still outstanding — the
                            unpaid amount is booked as a loss rather than
                            quietly disappearing.
                        </span>
                    </span>
                </label>

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
                        Keep it active
                    </Button>
                    <Button
                        type="submit"
                        variant="danger"
                        disabled={pending || reason.trim() === ""}
                        stackOnMobile
                    >
                        {pending ? "Cancelling…" : "Cancel contract"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
