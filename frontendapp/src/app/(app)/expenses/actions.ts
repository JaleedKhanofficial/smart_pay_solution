"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { Expense, ExpensePeriod, FormState } from "@/types/expense";

const PATH = "/expenses";

const EXPENSE_FIELDS = [
    "kind",
    "period_id",
    "investor_id",
    "spent_on",
    "description",
    "amount",
    "remarks",
] as const;

const PERIOD_FIELDS = ["label", "starts_on", "ends_on", "note"] as const;

/** Everything the user typed, so a rejected submission can be re-seeded. */
function submittedValues(
    formData: FormData,
    fields: readonly string[]
): Record<string, string> {
    const values: Record<string, string> = {};

    for (const field of fields) {
        values[field] = String(formData.get(field) ?? "");
    }

    return values;
}

function toFailure(
    error: unknown,
    formData: FormData,
    fields: readonly string[],
    attempt: number
): FormState {
    const base = { values: submittedValues(formData, fields), attempt };

    if (error instanceof ApiError) {
        return {
            ...base,
            ok: false,
            message: error.message,
            errors: error.messages,
        };
    }

    return {
        ...base,
        ok: false,
        message:
            "Could not reach the API. Is the NestJS server running on port 5000?",
        errors: [],
    };
}

/**
 * Both screens change on every write: the register lists the expenses, and the
 * report divides them. Revalidating one and not the other is how a total comes
 * to disagree with the rows it was added from.
 */
function revalidateBoth(): void {
    revalidatePath("/expenses");
    revalidatePath("/expenses/periods");
    revalidatePath("/reports/expenses");
    // An investor's payable is net of what they carry (BR-31).
    revalidatePath("/investors");
    revalidatePath("/reports/summary");
}

/**
 * SRS §4.15. Record or correct one expense.
 *
 * Unlike an investor ledger line, an expense is editable outright: it records
 * what the business spent, not a movement of somebody's money, and every share
 * derived from it is recomputed on the next read.
 */
export async function saveExpense(
    id: number | null,
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;
    const kind = String(formData.get("kind") ?? "common");

    const body = {
        kind,
        // The API refuses the column that does not belong to the kind, so the
        // unused one is left off entirely rather than sent empty.
        // A common expense names no period from the form: the API files it
        // under the open one. An edit carries the period it already had.
        ...(kind === "common"
            ? formData.get("period_id")
                ? { period_id: Number(formData.get("period_id")) }
                : {}
            : { investor_id: Number(formData.get("investor_id") ?? 0) }),
        spent_on: String(formData.get("spent_on") ?? ""),
        description: String(formData.get("description") ?? "").trim(),
        amount: Number(formData.get("amount") ?? 0),
        remarks: String(formData.get("remarks") ?? "").trim() || undefined,
    };

    try {
        await apiCallWithRefresh<Expense>(
            id ? `${PATH}/${id}` : PATH,
            id ? "PATCH" : "POST",
            body
        );
    } catch (error) {
        return toFailure(error, formData, EXPENSE_FIELDS, attempt);
    }

    revalidateBoth();

    return {
        ok: true,
        message: id ? "Expense updated." : "Expense recorded.",
        errors: [],
        attempt,
    };
}

export async function deleteExpense(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error, new FormData(), EXPENSE_FIELDS, 0);
    }

    revalidateBoth();

    return { ok: true, message: "Expense removed.", errors: [], attempt: 0 };
}

/**
 * BR-28. Open or amend a period.
 *
 * A period exists because the roster changes: a pot raised while six people
 * were in has to stay divided by those six, whoever is on the books when the
 * report is next opened.
 */
export async function savePeriod(
    id: number | null,
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;

    const body = {
        label: String(formData.get("label") ?? "").trim(),
        starts_on: String(formData.get("starts_on") ?? ""),
        ends_on: String(formData.get("ends_on") ?? "") || undefined,
        note: String(formData.get("note") ?? "").trim() || undefined,
        closed: formData.get("closed") === "on",
    };

    try {
        await apiCallWithRefresh<ExpensePeriod>(
            id ? `${PATH}/periods/${id}` : `${PATH}/periods`,
            id ? "PATCH" : "POST",
            body
        );
    } catch (error) {
        return toFailure(error, formData, PERIOD_FIELDS, attempt);
    }

    revalidateBoth();

    return {
        ok: true,
        message: id ? "Period updated." : "Period opened.",
        errors: [],
        attempt,
    };
}

export async function deletePeriod(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${PATH}/periods/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error, new FormData(), PERIOD_FIELDS, 0);
    }

    revalidateBoth();

    return { ok: true, message: "Period removed.", errors: [], attempt: 0 };
}

/**
 * BR-28/BR-29. Who carries this pot, replaced in one call.
 *
 * The whole membership goes at once rather than a row at a time: a split is
 * only meaningful as a set, and a half-applied change would divide a pot
 * between a roster nobody chose.
 */
export async function setPeriodMembers(
    id: number,
    members: { investor_id: number; waived: boolean; waive_reason?: string }[]
): Promise<FormState> {
    try {
        await apiCallWithRefresh<ExpensePeriod>(
            `${PATH}/periods/${id}/members`,
            "PUT",
            { members }
        );
    } catch (error) {
        return toFailure(error, new FormData(), PERIOD_FIELDS, 0);
    }

    revalidateBoth();

    return { ok: true, message: "Members saved.", errors: [], attempt: 0 };
}
