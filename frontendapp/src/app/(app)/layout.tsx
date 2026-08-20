import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ApiError } from "@/api/api.repository";
import { AppShell } from "@/components/app-shell";
import { AlertDialogProvider } from "@/components/ui/alert-dialog";
import { apiCall } from "@/lib/api";
import { visibleSections } from "@/lib/navigation";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import {
    DEFAULT_THEME_MODE,
    THEME_MODE_COOKIE,
    isThemeMode,
} from "@/lib/theme-mode";
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
    const store = await cookies();
    const collapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";

    const storedMode = store.get(THEME_MODE_COOKIE)?.value;
    const mode = isThemeMode(storedMode) ? storedMode : DEFAULT_THEME_MODE;

    return (
        <AlertDialogProvider>
            <AppShell
                sections={visibleSections(user.role)}
                user={user}
                defaultCollapsed={collapsed}
                themeMode={mode}
            >
                {children}
            </AppShell>
        </AlertDialogProvider>
    );
}
