"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { FormState, Setting } from "@/types/setting";

const SETTINGS_PATH = "/settings";

function toNumber(value: FormDataEntryValue | null): number {
    return Number(String(value ?? "").trim());
}

/**
 * FR-SET-02. Sends the whole screen as one patch.
 *
 * Every field is read and sent, not just the changed ones: the API compares
 * against what is stored and audit-logs only what actually moved, so sending
 * an unchanged value costs nothing and saves the browser from tracking dirty
 * state across five groups of controls.
 *
 * The shapes are built here rather than posted raw, because a checkbox arrives
 * as `"on"` or absent and a number as a string — the registry validates types
 * strictly and would reject both.
 */
export async function saveSettings(
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;

    const settings: Record<string, unknown> = {
        business_identity: {
            name: String(formData.get("business_name") ?? "").trim(),
            tagline: String(formData.get("business_tagline") ?? "").trim(),
            address: String(formData.get("business_address") ?? "").trim(),
            phone: String(formData.get("business_phone") ?? "").trim(),
            email: String(formData.get("business_email") ?? "").trim(),
        },
        plan_months_min: toNumber(formData.get("plan_months_min")),
        plan_months_max: toNumber(formData.get("plan_months_max")),
        // An unchecked box is absent from the form data entirely, which is
        // exactly how it must read as false rather than as "unchanged".
        allow_overpayment: formData.get("allow_overpayment") === "on",
        punctuality_thresholds: [0, 1, 2, 3, 4].map((index) =>
            toNumber(formData.get(`band_${index}`))
        ),
        loyalty: {
            gold_min_within_pct: toNumber(formData.get("gold_min_within_pct")),
            silver_max_late_pct: toNumber(formData.get("silver_max_late_pct")),
            platinum_reduction_pct: toNumber(
                formData.get("platinum_reduction_pct")
            ),
            gold_reduction_pct: toNumber(formData.get("gold_reduction_pct")),
            silver_reduction_pct: toNumber(formData.get("silver_reduction_pct")),
        },
        recycle_bin_retention_days: toNumber(
            formData.get("recycle_bin_retention_days")
        ),
    };

    try {
        await apiCallWithRefresh<Setting[]>(SETTINGS_PATH, "PATCH", {
            settings,
        });
    } catch (error) {
        if (error instanceof ApiError) {
            return {
                ok: false,
                message: error.message,
                errors: error.messages,
                attempt,
            };
        }

        return {
            ok: false,
            message:
                "Could not reach the API. Is the NestJS server running on port 5000?",
            errors: [],
            attempt,
        };
    }

    // Settings reach into the invoice, the contract form and the ledger, so
    // every screen that reads one has to be re-rendered.
    revalidatePath("/settings/system");
    revalidatePath("/contracts");
    revalidatePath("/payments");

    return {
        ok: true,
        message: "Settings saved. They take effect immediately.",
        errors: [],
        attempt,
    };
}
