"use client";

import { useActionState, useEffect, useRef } from "react";
import { savePeriod } from "./actions";
import { TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE, type ExpensePeriod } from "@/types/expense";

type Props = {
    /** null opens a new period, a period amends it. */
    period: ExpensePeriod | null;
    onSaved: (message: string) => void;
    onCancel: () => void;
};

/**
 * BR-28. A period is a window with a roster.
 *
 * It exists because the roster changes. A pot raised while six people were in
 * has to stay divided by those six — not by however many are on the books when
 * somebody opens the report a year later. Members are set separately, once the
 * period exists to hold them.
 */
export function PeriodForm({ period, onSaved, onCancel }: Props) {
    const [state, formAction, pending] = useActionState(
        savePeriod.bind(null, period?.id ?? null),
        EMPTY_FORM_STATE
    );

    const reported = useRef(0);

    useEffect(() => {
        if (!state.ok || state.attempt === reported.current) return;

        reported.current = state.attempt;
        onSaved(state.message ?? "Saved.");
    }, [state.ok, state.attempt, state.message, onSaved]);

    const initial = (name: string, stored?: string | null) =>
        state.values?.[name] ?? stored ?? "";

    return (
        <form
            key={state.attempt}
            action={formAction}
            className="flex flex-col gap-4"
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <TextField
                        label="Label"
                        name="label"
                        required
                        maxLength={60}
                        defaultValue={initial("label", period?.label)}
                        placeholder="Common-1"
                    />
                </div>

                <TextField
                    label="Starts on"
                    name="starts_on"
                    type="date"
                    required
                    defaultValue={initial("starts_on", period?.starts_on)}
                />

                <TextField
                    label="Ends on"
                    name="ends_on"
                    type="date"
                    defaultValue={initial("ends_on", period?.ends_on)}
                    hint="Leave blank while the period is still running."
                />

                <div className="sm:col-span-2">
                    <TextAreaField
                        label="Note"
                        name="note"
                        maxLength={500}
                        defaultValue={initial("note", period?.note)}
                    />
                </div>

                <label className="flex items-start gap-2.5 sm:col-span-2">
                    <input
                        type="checkbox"
                        name="closed"
                        defaultChecked={period?.closed ?? false}
                        className="mt-0.5 size-4 rounded border-border accent-brand"
                    />
                    <span className="text-sm text-foreground">
                        Closed
                        <span className="block text-xs text-muted">
                            A closed period takes no further expenses. What it
                            already holds stays split exactly as it is.
                        </span>
                    </span>
                </label>
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
                </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onCancel} stackOnMobile>
                    Cancel
                </Button>
                <Button type="submit" disabled={pending} stackOnMobile>
                    {pending
                        ? "Saving…"
                        : period
                          ? "Save changes"
                          : "Open period"}
                </Button>
            </div>
        </form>
    );
}
