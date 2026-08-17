import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { apiCall } from "@/lib/api";
import type { SessionUser } from "@/types/customer";

/**
 * Modules 9-12 are admin-only (SRS §2.3). Hiding them in the sidebar is not
 * enough — a typed URL has to bounce too. The API enforces this as well.
 */
export default async function SettingsLayout({
    children,
}: {
    children: ReactNode;
}) {
    const user = await apiCall<SessionUser>("/auth/me");

    if (user.role !== "admin") redirect("/dashboard");

    return children;
}
