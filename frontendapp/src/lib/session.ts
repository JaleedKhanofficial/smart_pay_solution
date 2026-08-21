import { cookies } from "next/headers";
import { apiRepository } from "@/api/api.repository";
import type { AuthResponse } from "@/types/customer";

export const ACCESS_COOKIE = "sps_at";
export const REFRESH_COOKIE = "sps_rt";

const secure = process.env.NODE_ENV === "production";

/**
 * The browser never talks to the NestJS API directly — every call is made by
 * this Next.js server — so both tokens live in httpOnly cookies on the Next
 * origin and are never exposed to client JavaScript (NFR-04).
 */
export async function readTokens(): Promise<{
    access?: string;
    refresh?: string;
}> {
    const store = await cookies();

    return {
        access: store.get(ACCESS_COOKIE)?.value,
        refresh: store.get(REFRESH_COOKIE)?.value,
    };
}

export async function writeSession(auth: AuthResponse): Promise<void> {
    const store = await cookies();

    // Keeps its max-age deliberately: the access cookie disappearing at the
    // 15-minute mark is what tells proxy.ts to renew the session. Making this
    // a browser-session cookie would leave it in place after the token itself
    // had expired, and the user would be bounced to /login instead.
    store.set(ACCESS_COOKIE, auth.access_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: auth.expires_in,
    });

    // No max-age, so the browser discards it when it closes — shutting the
    // browser ends the session. The server-side lifetime (JWT_REFRESH_TTL)
    // caps it independently for a browser that is never closed.
    store.set(REFRESH_COOKIE, auth.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
    });
}

export async function clearSession(): Promise<void> {
    const store = await cookies();

    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
}

/** Rotates the refresh token and stores the new pair. Cookie writes are only
 *  legal in Server Actions and Route Handlers, so this must be called from one. */
export async function refreshSession(): Promise<boolean> {
    const { refresh } = await readTokens();

    if (!refresh) return false;

    try {
        const auth = await apiRepository.post<AuthResponse>("/auth/refresh", {
            refresh_token: refresh,
        });

        await writeSession(auth);

        return true;
    } catch {
        await clearSession();

        return false;
    }
}
