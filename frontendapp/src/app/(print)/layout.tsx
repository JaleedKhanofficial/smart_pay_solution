import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ApiError } from "@/api/api.repository";
import { apiCall } from "@/lib/api";
import type { SessionUser } from "@/types/customer";

/**
 * NFR-03. Documents print as themselves: no sidebar, no top bar, no theme.
 *
 * A route group rather than a flag on the page, because the app shell is a
 * layout — the only way not to render it is not to be inside it. `/contracts/
 * {id}/invoice` lives here while `/contracts/{id}/edit` stays in `(app)`;
 * different leaf paths, so the two groups never collide.
 *
 * The session is still resolved: proxy.ts has checked the cookies, and this
 * turns a stale token into /login rather than a broken document.
 */
export default async function PrintLayout({
    children,
}: {
    children: ReactNode;
}) {
    const user = await apiCall<SessionUser>("/auth/me").catch(
        (error: unknown) => {
            if (error instanceof ApiError && error.status === 401) return null;

            throw error;
        }
    );

    if (!user) redirect("/login");

    return <>{children}</>;
}
