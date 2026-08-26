"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { FormState, PaymentWriteResult } from "@/types/payment";

const PAYMENTS_PATH = "/payments";

/** The raw fields; every balance figure comes back from the server. */
const FORM_FIELDS = [
    "contract_id",
    "amount",
    "payment_date",
    "method",
    "note",
] as const;

function submittedValues(formData: FormData): Record<string, string> {
    const values: Record<string, string> = {};

    for (const field of FORM_FIELDS) {
        values[field] = String(formData.get(field) ?? "");
    }

    return values;
}

function toFailure(
    error: unknown,
    formData: FormData,
    attempt: number
): FormState {
    const base = { values: submittedValues(formData), attempt };

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
 * FR-PAY-04. Recording a collection.
 *
 * No redirect: the register stays where it is, because a collector takes
 * several payments in a row and losing the filtered view on each one is the
 * friction the popup exists to avoid. The result carries the contract's new
 * balance so the acknowledgement can say what actually happened (NFR-14.6).
 */
export async function savePayment(
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;

    const body = {
        contract_id: Number(formData.get("contract_id") ?? 0),
        amount: Number(formData.get("amount") ?? 0),
        payment_date: String(formData.get("payment_date") ?? ""),
        method: String(formData.get("method") ?? "Cash"),
        note: String(formData.get("note") ?? "").trim() || undefined,
        // FR-PAY-06-v2: only consulted when the setting permits overpayment.
        // With it off the API refuses regardless of what is sent here.
        confirm_overpayment: formData.get("confirm_overpayment") === "on",
    };

    let saved: PaymentWriteResult;

    try {
        saved = await apiCallWithRefresh<PaymentWriteResult>(
            PAYMENTS_PATH,
            "POST",
            body
        );
    } catch (error) {
        return toFailure(error, formData, attempt);
    }

    revalidatePath("/payments");
    revalidatePath("/contracts");

    return {
        ok: true,
        message: saved.contract.status_changed
            ? `Payment recorded. ${saved.payment.customer_name}'s contract is now fully paid.`
            : `Payment recorded. ${saved.contract.outstanding_amount} still outstanding.`,
        errors: [],
        attempt,
    };
}

/**
 * FR-PAY-08-v2. A void, not a delete: DELETE by verb, but it carries a reason
 * and the row survives. Voiding can reopen a completed contract (BR-12).
 */
export async function voidPayment(
    id: number,
    void_reason: string
): Promise<FormState> {
    let result: PaymentWriteResult;

    try {
        result = await apiCallWithRefresh<PaymentWriteResult>(
            `${PAYMENTS_PATH}/${id}`,
            "DELETE",
            { void_reason }
        );
    } catch (error) {
        return toFailure(error, new FormData(), 0);
    }

    revalidatePath("/payments");
    revalidatePath("/contracts");

    return {
        ok: true,
        message: result.contract.status_changed
            ? `Payment voided. The contract is active again, with ${result.contract.outstanding_amount} outstanding.`
            : `Payment voided. ${result.contract.outstanding_amount} outstanding.`,
        errors: [],
        attempt: 0,
    };
}
