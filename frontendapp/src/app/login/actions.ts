"use server";

import { redirect } from "next/navigation";
import { ApiError, apiRepository } from "@/api/api.repository";
import { clearSession, readTokens, writeSession } from "@/lib/session";
import type { AuthResponse, FormState } from "@/types/customer";

function toFailure(
    error: unknown,
    email: string,
    attempt: number
): FormState {
    // The email is echoed back so a wrong password does not clear it too.
    const base = { values: { email }, attempt };

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

export async function loginAction(
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const attempt = prevState.attempt + 1;

    let auth: AuthResponse;

    try {
        auth = await apiRepository.post<AuthResponse>("/auth/login", {
            email,
            password,
        });
    } catch (error) {
        return toFailure(error, email, attempt);
    }

    await writeSession(auth);

    // redirect() throws a control-flow signal, so it must sit outside the try.
    redirect("/customers");
}

export async function logoutAction(): Promise<void> {
    const { refresh } = await readTokens();

    try {
        if (refresh) {
            await apiRepository.post("/auth/logout", { refreshToken: refresh });
        }
    } catch {
        // A failed revoke must not trap the user in a session they left.
    }

    await clearSession();

    redirect("/login");
}
