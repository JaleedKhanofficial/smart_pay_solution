"use client";

import { useState, useTransition } from "react";
import { voidPayment } from "./actions";
import { fieldClass, labelClass } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import type { Payment } from "@/types/payment";

type Props = {
    payment: Payment | null;
    onClose: () => void;
    onDone: (message: string) => void;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/**
 * FR-PAY-08-v2. Voiding, not deleting. A void has to say why — this is the
 * record of a correction to the money, and "removed by someone, some time" is
 * not a record. A plain confirm() cannot carry a text field, which is why this
 * is its own dialog.
 */
export function VoidPaymentDialog({ payment, onClose, onDone }: Props) {
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function submit(event: React.FormEvent) {
        event.preventDefault();

        if (!payment) return;

        setError(null);

        startTransition(async () => {
            const result = await voidPayment(payment.id, reason.trim());

            if (result.ok) {
                onDone(result.message ?? "Payment voided.");
            } else {
                setError(result.message ?? "Could not void this payment.");
            }
        });
    }

    return (
        <Modal
            open={payment !== null}
            onClose={onClose}
            title={payment ? `Void payment #${payment.id}?` : "Void payment"}
            description={
                payment
                    ? `Rs. ${money.format(Number(payment.amount))} · ${payment.customer_name} · ${formatDate(payment.payment_date)}`
                    : undefined
            }
        >
            <form onSubmit={submit} className="flex flex-col gap-4">
                <p className="text-sm text-muted">
                    The payment stays in the register, struck through, with this
                    reason against it. The contract&apos;s balance is
                    recalculated — a fully paid contract becomes active again if
                    this reopens a balance.
                </p>

                <div>
                    <label className={labelClass} htmlFor="void_reason">
                        Reason
                    </label>
                    <textarea
                        id="void_reason"
                        name="void_reason"
                        rows={3}
                        required
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Cheque returned unpaid, entered twice, wrong contract…"
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
                        disabled={pending || reason.trim() === ""}
                        stackOnMobile
                    >
                        {pending ? "Voiding…" : "Void payment"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
