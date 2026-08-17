"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCustomer, updateCustomer } from "./actions";
import { EMPTY_FORM_STATE, type Customer } from "@/types/customer";

const fieldClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

const labelClass =
    "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

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
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {isEditing ? "Edit customer" : "Add customer"}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className={labelClass} htmlFor="name">
                        Name
                    </label>
                    <input
                        id="name"
                        name="name"
                        required
                        maxLength={120}
                        defaultValue={customer?.name ?? ""}
                        placeholder="Ali Raza"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="cnic">
                        CNIC
                    </label>
                    <input
                        id="cnic"
                        name="cnic"
                        required
                        maxLength={15}
                        inputMode="numeric"
                        defaultValue={customer?.cnic ?? ""}
                        placeholder="12345-1234567-1"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="phoneNumber">
                        Phone number
                    </label>
                    <input
                        id="phoneNumber"
                        name="phoneNumber"
                        required
                        maxLength={20}
                        inputMode="tel"
                        defaultValue={customer?.phoneNumber ?? ""}
                        placeholder="0300-1234567"
                        className={fieldClass}
                    />
                </div>

                <div className="sm:col-span-2">
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
                <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
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

            <div className="mt-5 flex items-center gap-3">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
                        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                        Cancel
                    </button>
                ) : null}
            </div>
        </form>
    );
}
