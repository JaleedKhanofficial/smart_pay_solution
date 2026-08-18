import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ApiError } from "@/api/api.repository";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { apiCall } from "@/lib/api";
import { visibleSections } from "@/lib/navigation";
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

    return (
        <ToastProvider>
            <AppShell sections={visibleSections(user.role)} user={user}>
                {children}
            </AppShell>
        </ToastProvider>
    );
}
