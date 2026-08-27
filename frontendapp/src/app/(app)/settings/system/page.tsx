import type { Metadata } from "next";
import { SettingsForm } from "./settings-form";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { apiCall } from "@/lib/api";
import type { Setting } from "@/types/setting";

export const metadata: Metadata = {
    title: "System settings · SmartPay Solutions",
    description: "Business rules that change without a redeploy",
};

/**
 * Module 12 (SRS §4.12). Admin only — the API enforces that; the sidebar
 * already hides the link for an operator (FR-AUT-06).
 *
 * Every label, description and default on this screen comes from the server's
 * settings registry, so the page cannot describe a rule differently from the
 * module that reads it.
 */
export default async function SystemSettingsPage() {
    let settings: Setting[] = [];
    let loadError: string | null = null;

    try {
        settings = await apiCall<Setting[]>("/settings");
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load settings: ${error.message}`
                : "Could not load settings.";
    }

    return (
        <PageContainer width="narrow">
            <PageHeader
                eyebrow="Module 12"
                title="System settings"
                description="Business rules the owner controls, without a redeploy."
            />

            {loadError ? (
                <p className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : (
                <SettingsForm settings={settings} />
            )}
        </PageContainer>
    );
}
