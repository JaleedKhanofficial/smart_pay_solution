"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { FormState, User } from "@/types/user";

const USERS_PATH = "/users";

/** Echoed back after a rejected save — never the password. */
const ECHOED_FIELDS = ["name", "email", "role", "status"] as const;

function submittedValues(formData: FormData): Record<string, string> {
    const values: Record<string, string> = {};

    for (const field of ECHOED_FIELDS) {
        values[field] = String(formData.get(field) ?? "");
    }

    return values;
}

function toFailure(
    error: unknown,
    formData: FormData,
    attempt: number
): FormState {
    // The password is deliberately absent from `values`: re-seeding it into a
    // rendered field would put a plain credential in the HTML of the retry.
    const base = { values: submittedValues(formData), attempt };

    if (error instanceof ApiError) {
        return {
            ...base,
            ok: false,
            message: error.message,
            errors: error.messages,
        };
    }

    return {
        ...base,
        ok: false,
        message:
            "Could not reach the API. Is the NestJS server running on port 5000?",
        errors: [],
    };
}

/**
 * FR-USR-01 / FR-USR-02-v2. Creates or edits a staff account.
 *
 * On an edit the password is sent **only when one was typed** — an empty box
 * means "leave it alone", not "clear it". The API treats an omitted password
 * the same way.
 */
export async function saveUser(
    id: number | null,
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;
    const password = String(formData.get("password") ?? "");

    const body = {
        name: String(formData.get("name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim().toLowerCase(),
        role: String(formData.get("role") ?? "operator"),
        status: String(formData.get("status") ?? "active"),
        ...(password ? { password } : {}),
    };

    try {
        await apiCallWithRefresh<User>(
            id ? `${USERS_PATH}/${id}` : USERS_PATH,
            id ? "PATCH" : "POST",
            body
        );
    } catch (error) {
        return toFailure(error, formData, attempt);
    }

    revalidatePath("/settings/users");

    return {
        ok: true,
        message: id
            ? `${body.name} updated.${password ? " Their password was reset." : ""}`
            : `${body.name} can now sign in.`,
        errors: [],
        attempt,
    };
}

/** FR-USR-01 / FR-USR-03. A soft delete; the guards live on the server. */
export async function deleteUser(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${USERS_PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error, new FormData(), 0);
    }

    revalidatePath("/settings/users");

    return { ok: true, message: "Account deleted.", errors: [], attempt: 0 };
}

/** FR-USR-01. Enable or disable in one click from the register. */
export async function setUserStatus(
    id: number,
    status: "active" | "disabled"
): Promise<FormState> {
    try {
        await apiCallWithRefresh<User>(`${USERS_PATH}/${id}`, "PATCH", {
            status,
        });
    } catch (error) {
        return toFailure(error, new FormData(), 0);
    }

    revalidatePath("/settings/users");

    return {
        ok: true,
        message:
            status === "disabled"
                ? "Account disabled. Any signed-in session stops working on its next request."
                : "Account enabled.",
        errors: [],
        attempt: 0,
    };
}
