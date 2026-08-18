import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ApiError } from "@/api/api.repository";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { apiCall } from "@/lib/api";
import { visibleSections } from "@/lib/navigation";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import type { SessionUser } from "@/types/customer";

/**
 * proxy.ts has already checked the cookies; this resolves the actual user so
 * the sidebar can hide what their role cannot reach (FR-AUT-06).
 */
export default async function AppLayout({
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

    // Read on the server so the rail renders at its stored width on first paint.
    const collapsed =
        (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

    return (
        <ToastProvider>
            <AppShell
                sections={visibleSections(user.role)}
                user={user}
                defaultCollapsed={collapsed}
            >
                {children}
            </AppShell>
        </ToastProvider>
    );
}
