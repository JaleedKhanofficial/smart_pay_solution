"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePayment } from "./actions";
import { SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComboboxField } from "@/components/ui/combobox";
import { formatDate } from "@/lib/format";
import { EMPTY_FORM_STATE } from "@/types/customer";
import {
    PAYMENT_METHODS,
    type CollectableContract,
} from "@/types/payment";

type Props = {
    contracts: CollectableContract[];
    /** Preselected when the collector arrived from a contract row. */
    initialContractId: number | null;
    onSaved: (message: string) => void;
    onCancel: () => void;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string | null): string {
    if (value === null) return "—";

    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function PaymentForm({
    contracts,
    initialContractId,
    onSaved,
    onCancel,
}: Props) {
    const [state, formAction, pending] = useActionState(
        savePayment,
        EMPTY_FORM_STATE
    );

    // Each submission bumps `attempt`, so recording the one already handled is
    // what stops a re-render from reporting the same success twice.
    const reported = useRef(0);

    useEffect(() => {
        if (!state.ok || state.attempt === reported.current) return;

        reported.current = state.attempt;
        onSaved(state.message ?? "Payment recorded.");
    }, [state.ok, state.attempt, state.message, onSaved]);

    // The form is keyed on `attempt`, so a rejected submission remounts it and
    // these initialisers run again. Seeding from the echoed values is what
    // stops a refused overpayment from also wiping the chosen contract — the
    // collector should only have to tick the box, not start over.
    const [contractId, setContractId] = useState(
        state.values?.contract_id ||
            (initialContractId === null ? "" : String(initialContractId))
    );

    const selected =
        contracts.find((row) => String(row.contract_id) === contractId) ?? null;

    // FR-PAY-03: the prefill is the *remainder* of the next unpaid installment,
    // not a fresh full one — asking for 5,500 again when 2,000 of it is already
    // in would overpay the plan. The server computes it; this only displays it.
    const [amount, setAmount] = useState(
        state.values?.amount || (selected?.next_amount ?? "")
    );

    // A resubmitted amount counts as hand-typed: it must not be overwritten by
    // the prefill if the collector then switches contract.
    const [touched, setTouched] = useState(Boolean(state.values?.amount));

    function chooseContract(value: string) {
        setContractId(value);

        const row = contracts.find((item) => String(item.contract_id) === value);

        // A hand-typed amount survives changing the contract only if the
        // collector put it there; otherwise the new plan's figure wins.
        if (!touched) setAmount(row?.next_amount ?? "");
    }

    const options = contracts.map((row) => ({
        value: String(row.contract_id),
        label: `${row.reference} · ${row.customer_name} · ${row.product_name}`,
    }));

    return (
        <form key={state.attempt} action={formAction} className="flex flex-col gap-4">
            {contracts.length === 0 ? (
                <p className="rounded-md border border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted">
                    No contract has a balance to collect. Every active plan is
                    fully paid.
                </p>
            ) : null}

            <ComboboxField
                label="Contract"
                name="contract_id"
                required
                options={options}
                defaultValue={contractId}
                placeholder="Search by reference, customer or product…"
                onValueChange={chooseContract}
            />

            {/* The balance panel. Everything here came with the picker payload,
                so selecting a contract costs no round trip. */}
            {selected ? (
                <div className="rounded-md border border-border bg-surface-muted px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Outstanding
                        </span>
                        <span className="text-lg font-semibold tabular-nums text-foreground">
                            {pkr(selected.outstanding_amount)}
                        </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between gap-2">
                            <dt className="text-muted">Paid so far</dt>
                            <dd className="tabular-nums">
                                {pkr(selected.paid_amount)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                            <dt className="text-muted">Financed</dt>
                            <dd className="tabular-nums">
                                {pkr(selected.financed_amount)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                            <dt className="text-muted">
                                Next installment
                                {selected.next_seq !== null
                                    ? ` (#${selected.next_seq})`
                                    : ""}
                            </dt>
                            <dd className="tabular-nums">
                                {pkr(selected.next_amount)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                            <dt className="text-muted">Due</dt>
                            <dd className="flex items-center gap-1.5 tabular-nums">
                                {selected.next_due_date
                                    ? formatDate(selected.next_due_date)
                                    : "—"}
                                {selected.past_due ? (
                                    <Badge tone="negative">past due</Badge>
                                ) : null}
                            </dd>
                        </div>
                    </dl>
                </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Amount (Rs.)"
                    name="amount"
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={amount}
                    onChange={(event) => {
                        setTouched(true);
                        setAmount(event.target.value);
                    }}
                    hint={
                        selected
                            ? `At most ${pkr(selected.outstanding_amount)}`
                            : undefined
                    }
                />
                <TextField
                    label="Payment date"
                    name="payment_date"
                    type="date"
                    required
                    max={today()}
                    defaultValue={state.values?.payment_date ?? today()}
                />
                <SelectField
                    label="Method"
                    name="method"
                    options={PAYMENT_METHODS.map((method) => ({
                        value: method,
                        label: method,
                    }))}
                    defaultValue={state.values?.method ?? "Cash"}
                />
                <div className="sm:col-span-2">
                    <TextAreaField
                        label="Reference / note"
                        name="note"
                        rows={2}
                        maxLength={500}
                        defaultValue={state.values?.note ?? ""}
                        placeholder="Cheque number, bank reference, or anything worth recording"
                    />
                </div>
            </div>

            {state.message && !state.ok ? (
                <div className="rounded-md border border-negative/40 bg-negative/8 px-4 py-3 text-sm text-negative">
                    {state.errors.length > 1 ? (
                        <>
                            <p className="mb-1 font-medium">
                                Please correct the following:
                            </p>
                            <ul className="list-inside list-disc space-y-1">
                                {state.errors.map((error) => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        state.message
                    )}

                    {/* FR-PAY-06-v2. The API answers an over-amount with the
                        exact overage; where the setting permits it, resending
                        with this ticked accepts it. Where it does not, the
                        refusal stands whatever is sent. */}
                    {/overpayment|more than the/i.test(state.message) ? (
                        <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
                            <input
                                type="checkbox"
                                name="confirm_overpayment"
                                className="mt-0.5 size-4 accent-chrome-800"
                            />
                            <span>
                                Accept this as an overpayment and record it
                                anyway.
                            </span>
                        </label>
                    ) : null}
                </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    stackOnMobile
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={pending || contracts.length === 0}
                    stackOnMobile
                >
                    <Icon name="creditCard" className="size-4" />
                    {pending ? "Recording…" : "Record payment"}
                </Button>
            </div>
        </form>
    );
}
