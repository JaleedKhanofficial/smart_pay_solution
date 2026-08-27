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
 * FR-SUM-02-v2. Capital and expenses are database records, not browser
 * storage — v1 kept them in localStorage, so the net balance depended on which
 * machine you opened the report from (§9.6).
 */
export async function addEntry(
    kind: "capital" | "expenses",
    amount: number,
    period_label: string,
    note: string
): Promise<FormState> {
    try {
        await apiCallWithRefresh<Entry>(`${REPORTS_PATH}/${kind}`, "POST", {
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
        message:
            kind === "capital" ? "Capital recorded." : "Expense recorded.",
        errors: [],
        attempt: 0,
    };
}

export async function removeEntry(
    kind: "capital" | "expenses",
    id: number
): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(
            `${REPORTS_PATH}/${kind}/${id}`,
            "DELETE"
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/reports/summary");

    return { ok: true, message: "Entry removed.", errors: [], attempt: 0 };
}
