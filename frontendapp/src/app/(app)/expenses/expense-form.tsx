"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveExpense } from "./actions";
import { TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { ComboboxField } from "@/components/ui/combobox";
import {
    EMPTY_FORM_STATE,
    type Expense,
    type ExpenseKind,
} from "@/types/expense";

type Props = {
    /** null adds a new one, an expense edits it. */
    expense: Expense | null;
    /** Which kind a new expense starts as — the list the button sat on. */
    startKind: ExpenseKind;
    investors: { id: number; label: string }[];
    onSaved: (message: string) => void;
    onCancel: () => void;
};

/** Today as `YYYY-MM-DD`, in local time rather than UTC. */
function today(): string {
    const now = new Date();

    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10);
}

const KINDS: { value: ExpenseKind; title: string; text: string }[] = [
    {
        value: "common",
        title: "Common",
        text: "Pen, copy, laptop. Divided between all investors.",
    },
    {
        value: "individual",
        title: "Individual",
        text: "Travel, food on a deal. Charged to one investor.",
    },
];

/**
 * One expense. Four questions: which kind, when, what, how much — plus whose,
 * when it is an individual one. A common expense asks nothing about periods:
 * the API files it under the open one.
 */
export function ExpenseForm({
    expense,
    startKind,
    investors,
    onSaved,
    onCancel,
}: Props) {
    const [state, formAction, pending] = useActionState(
        saveExpense.bind(null, expense?.id ?? null),
        EMPTY_FORM_STATE
    );

    const [kind, setKind] = useState<ExpenseKind>(expense?.kind ?? startKind);

    // Each submission bumps `attempt`, so recording the one already handled is
    // what stops a re-render from reporting the same success twice.
    const reported = useRef(0);

    useEffect(() => {
        if (!state.ok || state.attempt === reported.current) return;

        reported.current = state.attempt;
        onSaved(state.message ?? "Saved.");
    }, [state.ok, state.attempt, state.message, onSaved]);

    const initial = (name: string, stored?: string | null) =>
        state.values?.[name] ?? stored ?? "";

    const investorOptions = investors.map((investor) => ({
        value: String(investor.id),
        label: investor.label,
    }));

    return (
        <form
            key={state.attempt}
            action={formAction}
            className="flex flex-col gap-4"
        >
            <input type="hidden" name="kind" value={kind} />

            {/* An edit keeps the period the expense already sits in. */}
            {kind === "common" && expense?.period_id ? (
                <input
                    type="hidden"
                    name="period_id"
                    value={expense.period_id}
                />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
                {KINDS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setKind(option.value)}
                        aria-pressed={kind === option.value}
                        className={`rounded-lg border px-4 py-3 text-left transition ${
                            kind === option.value
                                ? "border-brand bg-brand/8"
                                : "border-border hover:bg-surface-muted"
                        }`}
                    >
                        <span className="block text-sm font-semibold text-foreground">
                            {option.title}
                        </span>
                        <span className="block text-xs text-muted">
                            {option.text}
                        </span>
                    </button>
                ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {kind === "individual" ? (
                    <div className="sm:col-span-2">
                        <ComboboxField
                            label="Investor"
                            name="investor_id"
                            required
                            options={investorOptions}
                            defaultValue={initial(
                                "investor_id",
                                expense?.investor_id
                                    ? String(expense.investor_id)
                                    : ""
                            )}
                        />
                    </div>
                ) : null}

                <div className="sm:col-span-2">
                    <TextField
                        label="Description"
                        name="description"
                        required
                        maxLength={200}
                        defaultValue={initial(
                            "description",
                            expense?.description
                        )}
                        placeholder={
                            kind === "common" ? "Laptop" : "Transport and food"
                        }
                    />
                </div>

                <TextField
                    label="Amount (Rs.)"
                    name="amount"
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    defaultValue={initial("amount", expense?.amount)}
                />

                <TextField
                    label="Date"
                    name="spent_on"
                    type="date"
                    required
                    defaultValue={initial(
                        "spent_on",
                        expense?.spent_on ?? today()
                    )}
                />

                <div className="sm:col-span-2">
                    <TextField
                        label="Note (optional)"
                        name="remarks"
                        maxLength={500}
                        defaultValue={initial("remarks", expense?.remarks)}
                    />
                </div>
            </div>

            {state.message && !state.ok ? (
                <div className="rounded-md border border-negative/40 bg-negative/8 px-4 py-3 text-sm text-negative">
                    {state.errors.length > 1 ? (
                        <ul className="list-inside list-disc space-y-1">
                            {state.errors.map((error) => (
                                <li key={error}>{error}</li>
                            ))}
                        </ul>
                    ) : (
                        state.message
                    )}
                </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onCancel} stackOnMobile>
                    Cancel
                </Button>
                <Button type="submit" disabled={pending} stackOnMobile>
                    {pending ? "Saving…" : expense ? "Save" : "Add expense"}
                </Button>
            </div>
        </form>
    );
}
