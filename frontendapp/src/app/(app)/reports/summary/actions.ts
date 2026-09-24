"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { Entry, FormState } from "@/types/report";

const REPORTS_PATH = "/reports";

function toFailure(error: unknown): FormState {
    if (error instanceof ApiError) {
        return {
            ok: false,
            message: error.message,
            errors: error.messages,
            attempt: 0,
        };
    }

    return {
        ok: false,
        message:
            "Could not reach the API. Is the NestJS server running on port 5000?",
        errors: [],
        attempt: 0,
    };
}

/**
 * FR-SUM-02-v2. Capital is a database record, not browser storage — v1 kept it
 * in localStorage, so the net balance depended on which machine you opened the
 * report from (§9.6).
 *
 * Expenses used to be recorded here too. They are their own module now
 * (SRS §4.15), because a total with nowhere to say whose cost it was could not
 * produce the per-investor bill the business actually keeps.
 */
export async function addEntry(
    amount: number,
    period_label: string,
    note: string
): Promise<FormState> {
    try {
        await apiCallWithRefresh<Entry>(`${REPORTS_PATH}/capital`, "POST", {
            amount,
            period_label,
            note: note.trim() || undefined,
        });
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/reports/summary");

    return {
        ok: true,
        message: "Capital recorded.",
        errors: [],
        attempt: 0,
    };
}

export async function removeEntry(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(
            `${REPORTS_PATH}/capital/${id}`,
            "DELETE"
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/reports/summary");

    return { ok: true, message: "Entry removed.", errors: [], attempt: 0 };
}
