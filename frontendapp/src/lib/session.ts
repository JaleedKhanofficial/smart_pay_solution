import { cookies } from "next/headers";
import { apiRepository } from "@/api/api.repository";
import type { AuthResponse } from "@/types/customer";

export const ACCESS_COOKIE = "sps_at";
export const REFRESH_COOKIE = "sps_rt";

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // matches JWT_REFRESH_TTL

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

    // The access cookie expires with the token, so its absence is the signal
    // to refresh.
    store.set(ACCESS_COOKIE, auth.accessToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: auth.expiresIn,
    });

    store.set(REFRESH_COOKIE, auth.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: REFRESH_MAX_AGE,
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
            refreshToken: refresh,
        });

        await writeSession(auth);

        return true;
    } catch {
        await clearSession();

        return false;
    }
}
