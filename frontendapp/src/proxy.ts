import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_COOKIE = "sps_at";
const REFRESH_COOKIE = "sps_rt";

/**
 * Session gate (FR-AUT-06). Runs before any protected page renders:
 *   access cookie present  → continue
 *   only refresh cookie    → bounce through /session/refresh and come back
 *   neither                → /login
 *
 * The API is still the enforcement layer (FR-AUT-05); this only saves a render.
 * Renamed from `middleware` in Next 16.
 */
export function proxy(request: NextRequest): NextResponse {
    // Server Functions POST to the page they live on. They run their own
    // refresh-and-retry, and a redirected POST would break them, so let
    // non-GET requests through untouched.
    if (request.method !== "GET") {
        return NextResponse.next();
    }

    const cookies = request.cookies;

    if (cookies.has(ACCESS_COOKIE)) {
        return NextResponse.next();
    }

    const { pathname, search } = request.nextUrl;

    if (cookies.has(REFRESH_COOKIE)) {
        const url = new URL("/session/refresh", request.url);
        url.searchParams.set("next", `${pathname}${search}`);

        return NextResponse.redirect(url);
    }

    return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
    matcher: [
        /*
         * Everything except:
         * - login and the refresh handler (they must stay reachable)
         * - Next internals and static assets
         */
        "/((?!login|session/refresh|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
    ],
};
