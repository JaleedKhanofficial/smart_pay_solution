"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { EMPTY_FORM_STATE } from "@/types/customer";

const fieldClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-navy-600 disabled:opacity-60";

const labelClass =
    "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted";

export function LoginForm() {
    const [state, formAction, pending] = useActionState(
        loginAction,
        EMPTY_FORM_STATE
    );

    return (
        <form action={formAction} className="flex flex-col gap-4">
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
                className="mt-2 rounded-md bg-navy-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
            >
                {pending ? "Signing in…" : "Sign in"}
            </button>
        </form>
    );
}
