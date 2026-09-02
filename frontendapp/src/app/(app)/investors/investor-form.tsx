"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveInvestor } from "./actions";
import {
    MaskedField,
    SelectField,
    TextAreaField,
    TextField,
} from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/types/customer";
import type { Investor } from "@/types/investor";

type Props = {
    /** null adds, an investor edits. */
    investor: Investor | null;
    onSaved: (message: string) => void;
    onCancel: () => void;
};

export function InvestorForm({ investor, onSaved, onCancel }: Props) {
    const isEditing = investor !== null;

    const [state, formAction, pending] = useActionState(
        saveInvestor.bind(null, investor?.id ?? null),
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
        <form key={state.attempt} action={formAction} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Full name"
                    name="full_name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={initial("full_name", investor?.full_name)}
                />
                <TextField
                    label="Father / husband name"
                    name="father_husband_name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={initial(
                        "father_husband_name",
                        investor?.father_husband_name
                    )}
                />
                <MaskedField
                    label="CNIC"
                    name="cnic_number"
                    mask="cnic"
                    required
                    defaultValue={initial("cnic_number", investor?.cnic_number)}
                />
                <MaskedField
                    label="Mobile"
                    name="mobile_number"
                    mask="mobile"
                    required
                    defaultValue={initial(
                        "mobile_number",
                        investor?.mobile_number
                    )}
                />
                <div className="sm:col-span-2">
                    <TextField
                        label="Address"
                        name="address"
                        required
                        minLength={5}
                        maxLength={300}
                        defaultValue={initial("address", investor?.address)}
                    />
                </div>
                <TextField
                    label="Email"
                    name="email"
                    type="email"
                    maxLength={160}
                    defaultValue={initial("email", investor?.email)}
                />
                <TextField
                    label="Agreement date"
                    name="agreement_date"
                    type="date"
                    defaultValue={initial(
                        "agreement_date",
                        investor?.agreement_date
                    )}
                />
                <SelectField
                    label="Status"
                    name="status"
                    options={[
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                    ]}
                    defaultValue={initial("status", investor?.status ?? "active")}
                    hint="An inactive investor takes no new deployments; existing ones keep recovering."
                />
                <div className="sm:col-span-2">
                    <TextAreaField
                        label="Notes"
                        name="notes"
                        rows={2}
                        maxLength={2000}
                        defaultValue={initial("notes", investor?.notes)}
                    />
                </div>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <input
                    type="checkbox"
                    name="loss_participation"
                    defaultChecked={investor?.loss_participation ?? true}
                    className="mt-0.5 size-4 accent-chrome-800"
                />
                <span>
                    <span className="font-medium text-foreground">
                        Shares in losses
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                        BR-20. Off, a written-off contract charges the whole
                        unrecovered amount to the house instead of this
                        investor&apos;s buckets.
                    </span>
                </span>
            </label>

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

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    stackOnMobile
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={pending} stackOnMobile>
                    {pending
                        ? "Saving…"
                        : isEditing
                          ? "Save changes"
                          : "Add investor"}
                </Button>
            </div>
        </form>
    );
}
