import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/session";

/**
 * Renews the session, then returns the user to where they were. A Route
 * Handler is used because Server Components may not write cookies.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const url = new URL(request.url);
    const requested = url.searchParams.get("next") ?? "/customers";

    // Only same-origin paths: "//evil.com" is a valid URL path prefix.
    const next =
        requested.startsWith("/") && !requested.startsWith("//")
            ? requested
            : "/customers";

    const renewed = await refreshSession();

    return NextResponse.redirect(
        new URL(renewed ? next : "/login", url.origin)
    );
}
