"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
// Shared with the customer form so the mobile sizing stays in one place.
import { fieldClass, labelClass } from "@/components/form-fields";
import { EMPTY_FORM_STATE } from "@/types/customer";

export function LoginForm() {
    const [state, formAction, pending] = useActionState(
        loginAction,
        EMPTY_FORM_STATE
    );

    return (
        // Keyed so the email is restored after React resets the form.
        <form
            key={state.attempt}
            action={formAction}
            className="flex flex-col gap-4"
        >
            <div>
                <label className={labelClass} htmlFor="email">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    autoFocus
                    defaultValue={state.values?.email ?? ""}
                    placeholder="Enter Email"
                    className={fieldClass}
                />
            </div>

            <div>
                <label className={labelClass} htmlFor="password">
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter Password"
                    required
                    autoComplete="current-password"
                    className={fieldClass}
                />
            </div>

            {state.message ? (
                <p className="rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative">
                    {state.message}
                </p>
            ) : null}

            <button
                type="submit"
                disabled={pending}
                className="mt-2 w-full rounded-md bg-navy-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-60 sm:py-2.5"
            >
                {pending ? "Signing in…" : "Sign in"}
            </button>
        </form>
    );
}
