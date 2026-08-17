"use server";

import { redirect } from "next/navigation";
import { ApiError, apiRepository } from "@/api/api.repository";
import { clearSession, readTokens, writeSession } from "@/lib/session";
import type { AuthResponse, FormState } from "@/types/customer";

function toFailure(error: unknown): FormState {
    if (error instanceof ApiError) {
        return { ok: false, message: error.message, errors: error.messages };
    }

    return {
        ok: false,
        message:
            "Could not reach the API. Is the NestJS server running on port 5000?",
        errors: [],
    };
}

export async function loginAction(
    _prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    let auth: AuthResponse;

    try {
        auth = await apiRepository.post<AuthResponse>("/auth/login", {
            email,
            password,
        });
    } catch (error) {
        return toFailure(error);
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
