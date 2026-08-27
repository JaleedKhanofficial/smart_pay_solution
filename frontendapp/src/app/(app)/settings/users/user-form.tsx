"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveUser } from "./actions";
import { SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/types/customer";
import { MIN_PASSWORD_LENGTH, type User } from "@/types/user";

type Props = {
    /** null adds, a user edits. */
    user: User | null;
    /** The signed-in admin, so the form can explain what it will not let them do. */
    selfId: number;
    onSaved: (message: string) => void;
    onCancel: () => void;
};

export function UserForm({ user, selfId, onSaved, onCancel }: Props) {
    const isEditing = user !== null;
    const isSelf = user?.id === selfId;

    const [state, formAction, pending] = useActionState(
        saveUser.bind(null, user?.id ?? null),
        EMPTY_FORM_STATE
    );

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

    return (
        <form key={state.attempt} action={formAction} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={initial("name", user?.name)}
                />
                <TextField
                    label="Email"
                    name="email"
                    type="email"
                    required
                    maxLength={160}
                    defaultValue={initial("email", user?.email)}
                    hint="Used to sign in. Must be unique."
                />
                <SelectField
                    label="Role"
                    name="role"
                    options={[
                        { value: "operator", label: "Operator" },
                        { value: "admin", label: "Admin" },
                    ]}
                    defaultValue={initial("role", user?.role ?? "operator")}
                    hint="An operator cannot see cost price, cancel a contract, or open settings."
                />
                <SelectField
                    label="Status"
                    name="status"
                    options={[
                        { value: "active", label: "Active" },
                        { value: "disabled", label: "Disabled" },
                    ]}
                    defaultValue={initial("status", user?.status ?? "active")}
                    hint="A disabled account stops working on its next request."
                />
            </div>

            <TextField
                label={isEditing ? "New password" : "Password"}
                name="password"
                type="password"
                autoComplete="new-password"
                required={!isEditing}
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={200}
                placeholder={
                    isEditing ? "Leave blank to keep the current password" : ""
                }
                hint={`At least ${MIN_PASSWORD_LENGTH} characters. Stored only as an Argon2id hash — nobody, including an admin, can read it back.`}
            />

            {/* FR-USR-03, said before they try rather than after it is refused. */}
            {isSelf ? (
                <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
                    This is your own account. You can change your name, email and
                    password here, but you cannot disable or demote yourself —
                    ask another admin to do that.
                </p>
            ) : null}

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
                          : "Create account"}
                </Button>
            </div>
        </form>
    );
}
