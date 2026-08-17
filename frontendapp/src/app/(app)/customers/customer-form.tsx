"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCustomer, updateCustomer } from "./actions";
import { EMPTY_FORM_STATE, type Customer } from "@/types/customer";

const fieldClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-navy-600 disabled:opacity-60";

const labelClass =
    "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted";

type Props = {
    customer: Customer | null;
    onSaved: (message: string) => void;
    onCancel: () => void;
};

export function CustomerForm({ customer, onSaved, onCancel }: Props) {
    const isEditing = customer !== null;

    const action = isEditing
        ? updateCustomer.bind(null, customer.id)
        : createCustomer;

    const [state, formAction, pending] = useActionState(
        action,
        EMPTY_FORM_STATE
    );

    const formRef = useRef<HTMLFormElement>(null);
    // Each submission returns a fresh state object, so comparing identities
    // runs this reaction exactly once per submission.
    const handledState = useRef(state);

    useEffect(() => {
        if (state === handledState.current) return;
        handledState.current = state;

        if (!state.ok) return;

        if (!isEditing) {
            formRef.current?.reset();
        }

        onSaved(state.message ?? "Saved.");
    }, [state, isEditing, onSaved]);

    return (
        <form
            ref={formRef}
            action={formAction}
            className="rounded-xl border border-border bg-surface"
        >
            <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">
                    {isEditing ? "Edit customer" : "Add customer"}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                    CNIC and mobile are reformatted by the server; guarantors
                    and CNIC images arrive with FR-CUS-03/04.
                </p>
            </div>

            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <label className={labelClass} htmlFor="fullName">
                        Full name
                    </label>
                    <input
                        id="fullName"
                        name="fullName"
                        required
                        maxLength={150}
                        defaultValue={customer?.fullName ?? ""}
                        placeholder="Ali Raza"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="fatherHusbandName">
                        Father / husband name
                    </label>
                    <input
                        id="fatherHusbandName"
                        name="fatherHusbandName"
                        required
                        maxLength={150}
                        defaultValue={customer?.fatherHusbandName ?? ""}
                        placeholder="Muhammad Raza"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="cnicNumber">
                        CNIC
                    </label>
                    <input
                        id="cnicNumber"
                        name="cnicNumber"
                        required
                        maxLength={15}
                        inputMode="numeric"
                        defaultValue={customer?.cnicNumber ?? ""}
                        placeholder="12345-1234567-1"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="mobileNumber">
                        Mobile
                    </label>
                    <input
                        id="mobileNumber"
                        name="mobileNumber"
                        required
                        maxLength={20}
                        inputMode="tel"
                        defaultValue={customer?.mobileNumber ?? ""}
                        placeholder="0300-1234567"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="occupation">
                        Occupation
                    </label>
                    <input
                        id="occupation"
                        name="occupation"
                        required
                        maxLength={120}
                        defaultValue={customer?.occupation ?? ""}
                        placeholder="Shopkeeper"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="monthlyIncome">
                        Monthly income (Rs.)
                    </label>
                    <input
                        id="monthlyIncome"
                        name="monthlyIncome"
                        type="number"
                        required
                        min={0}
                        step="0.01"
                        defaultValue={customer?.monthlyIncome ?? ""}
                        placeholder="85000"
                        className={fieldClass}
                    />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass} htmlFor="address">
                        Address
                    </label>
                    <textarea
                        id="address"
                        name="address"
                        required
                        rows={2}
                        maxLength={500}
                        defaultValue={customer?.address ?? ""}
                        placeholder="House 12, Street 5, Lahore"
                        className={fieldClass}
                    />
                </div>
            </div>

            {!state.ok && state.message ? (
                <div className="mx-5 mb-5 rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative">
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

            <div className="flex items-center gap-3 border-t border-border px-5 py-4">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md bg-navy-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
                >
                    {pending
                        ? "Saving…"
                        : isEditing
                          ? "Save changes"
                          : "Add customer"}
                </button>

                {isEditing ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={pending}
                        className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60"
                    >
                        Cancel
                    </button>
                ) : null}
            </div>
        </form>
    );
}
