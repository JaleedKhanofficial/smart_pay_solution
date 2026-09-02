"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type {
    Bucket,
    FormState,
    Investor,
    InvestorTransaction,
} from "@/types/investor";

const PATH = "/investors";

/** Echoed back after a rejected save. */
const FIELDS = [
    "full_name",
    "father_husband_name",
    "cnic_number",
    "mobile_number",
    "address",
    "email",
    "agreement_date",
    "status",
    "notes",
] as const;

function submittedValues(formData: FormData): Record<string, string> {
    const values: Record<string, string> = {};

    for (const field of FIELDS) {
        values[field] = String(formData.get(field) ?? "");
    }

    return values;
}

function toFailure(error: unknown, values?: Record<string, string>): FormState {
    const base = { values, attempt: 0 };

    if (error instanceof ApiError) {
        return { ...base, ok: false, message: error.message, errors: error.messages };
    }

    return {
        ...base,
        ok: false,
        message:
            "Could not reach the API. Is the NestJS server running on port 5000?",
        errors: [],
    };
}

function refresh(id?: number): void {
    revalidatePath("/investors");
    if (id) revalidatePath(`/investors/${id}`);
}

/** FR-IVT-02 / FR-IVT-03 */
export async function saveInvestor(
    id: number | null,
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;
    const text = (name: string) => String(formData.get(name) ?? "").trim();

    const body = {
        full_name: text("full_name"),
        father_husband_name: text("father_husband_name"),
        cnic_number: text("cnic_number"),
        mobile_number: text("mobile_number"),
        address: text("address"),
        email: text("email") || undefined,
        loss_participation: formData.get("loss_participation") === "on",
        agreement_date: text("agreement_date") || undefined,
        status: text("status") || "active",
        notes: text("notes") || undefined,
    };

    try {
        await apiCallWithRefresh<Investor>(
            id ? `${PATH}/${id}` : PATH,
            id ? "PATCH" : "POST",
            body
        );
    } catch (error) {
        return { ...toFailure(error, submittedValues(formData)), attempt };
    }

    refresh(id ?? undefined);

    return {
        ok: true,
        message: id
            ? `${body.full_name} updated.`
            : `${body.full_name} added.`,
        errors: [],
        attempt,
    };
}

/** FR-IVT-04 */
export async function deleteInvestor(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error);
    }

    refresh(id);

    return { ok: true, message: "Investor removed.", errors: [], attempt: 0 };
}

/**
 * FR-IVT-05 / FR-IVT-06. A deposit always credits principal; a withdrawal
 * names its bucket, or lets the `withdrawal_source` setting choose.
 */
export async function recordMovement(
    id: number,
    kind: "deposits" | "withdrawals",
    body: {
        amount: number;
        txn_date: string;
        method: string;
        bucket?: Bucket;
        reference?: string;
    }
): Promise<FormState> {
    try {
        await apiCallWithRefresh<InvestorTransaction>(
            `${PATH}/${id}/${kind}`,
            "POST",
            body
        );
    } catch (error) {
        return toFailure(error);
    }

    refresh(id);

    return {
        ok: true,
        message: kind === "deposits" ? "Deposit recorded." : "Withdrawal recorded.",
        errors: [],
        attempt: 0,
    };
}

/**
 * FR-IVT-08. The only correction there is. The amount is signed and the
 * reason is required — the original line is never edited or removed.
 */
export async function recordAdjustment(
    id: number,
    body: {
        amount: number;
        bucket: Bucket;
        txn_date: string;
        reason: string;
    }
): Promise<FormState> {
    try {
        await apiCallWithRefresh<InvestorTransaction>(
            `${PATH}/${id}/adjustments`,
            "POST",
            body
        );
    } catch (error) {
        return toFailure(error);
    }

    refresh(id);

    return { ok: true, message: "Adjustment recorded.", errors: [], attempt: 0 };
}
