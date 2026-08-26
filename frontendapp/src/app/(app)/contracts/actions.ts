"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type {
    ContractDetail,
    ContractPreview,
    FormState,
} from "@/types/contract";

const CONTRACTS_PATH = "/contracts";

/** The raw terms; every derived figure comes back from the server. */
const TERM_FIELDS = [
    "customer_id",
    "product_id",
    "cost_price",
    "markup_pct",
    "down_payment",
    "plan_months",
    "product_condition",
    "start_date",
    "notes",
] as const;

/** Everything POST /contracts/preview needs: the pricing terms alone. */
type PreviewTerms = {
    cost_price: number;
    sale_price: number;
    markup_pct: number;
    down_payment: number;
    plan_months: number;
    product_condition: string;
    start_date: string;
};

/** The full create/update payload: the terms, plus who the deal is with. */
type Terms = Partial<PreviewTerms> & {
    customer_id?: number;
    product_id?: number;
    notes?: string;
};

/** The fields that arrive as numbers, so one reader can handle them all. */
type NumericField =
    | "customer_id"
    | "product_id"
    | "cost_price"
    | "sale_price"
    | "markup_pct"
    | "down_payment"
    | "plan_months";

/**
 * Reads the form into the shape the API validates.
 *
 * A field the form did not post is **left out**, not sent as zero. That is what
 * makes a locked contract editable: FR-CON-07-v2 disables every term input once
 * a payment exists, and a disabled input submits nothing — so coercing the
 * absences to 0 would fail `@Min(1)` on `customer_id` and, worse, would read as
 * a term change and trip the 409. The create path is unaffected: nothing is
 * disabled there, so every field is present and the API's own `@IsNumber`
 * rules catch anything genuinely missing.
 */
function toTerms(formData: FormData): Terms {
    const terms: Terms = {};

    const number = (field: NumericField) => {
        const raw = formData.get(field);

        if (raw === null || String(raw).trim() === "") return;

        terms[field] = Number(raw);
    };

    number("customer_id");
    number("product_id");
    number("cost_price");
    number("markup_pct");
    number("down_payment");
    number("plan_months");

    // One field on the form. The business applies its markup to what it paid,
    // so the sale price is the purchase price — the API keeps both columns
    // because Module 13 measures capital against cost (BR-15). BR-01's rupee
    // markup override still exists in the API but the form does not offer it;
    // omitting it is what tells the server to let the percentage decide.
    if (terms.cost_price !== undefined) terms.sale_price = terms.cost_price;

    const condition = formData.get("product_condition");
    if (condition !== null) terms.product_condition = String(condition);

    const start = formData.get("start_date");
    if (start !== null && String(start).trim() !== "") {
        terms.start_date = String(start);
    }

    const notes = String(formData.get("notes") ?? "").trim();
    if (notes !== "") terms.notes = notes;

    return terms;
}

function submittedValues(formData: FormData): Record<string, string> {
    const values: Record<string, string> = {};

    for (const field of TERM_FIELDS) {
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
 * FR-CON-04-v2. The live plan preview is priced by the **server**, using the
 * same code that will persist it — so the figures on screen and the figures
 * stored cannot disagree. Nothing is written.
 */
export async function previewContract(
    terms: PreviewTerms
): Promise<{ ok: true; preview: ContractPreview } | { ok: false; message: string }> {
    try {
        const preview = await apiCallWithRefresh<ContractPreview>(
            `${CONTRACTS_PATH}/preview`,
            "POST",
            terms
        );

        return { ok: true, preview };
    } catch (error) {
        return {
            ok: false,
            message:
                error instanceof ApiError
                    ? error.message
                    : "Could not price this plan.",
        };
    }
}

export async function saveContract(
    id: number | null,
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;
    const terms = toTerms(formData);

    let saved: { contract: ContractDetail; corrections: string[] };

    try {
        saved = await apiCallWithRefresh<{
            contract: ContractDetail;
            corrections: string[];
        }>(
            id ? `${CONTRACTS_PATH}/${id}` : CONTRACTS_PATH,
            id ? "PATCH" : "POST",
            terms
        );
    } catch (error) {
        return toFailure(error, formData, attempt);
    }

    revalidatePath("/contracts");

    // redirect() throws a control-flow signal, so it must sit outside the try.
    redirect(
        `/contracts?flash=${encodeURIComponent(
            id
                ? "Contract updated."
                : `Contract #${saved.contract.id} created — ${saved.contract.plan_months} installments scheduled.`
        )}`
    );
}

export async function deleteContract(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${CONTRACTS_PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error, new FormData(), 0);
    }

    revalidatePath("/contracts");

    return { ok: true, message: "Contract deleted.", errors: [], attempt: 0 };
}

/** FR-CON-08-v2. Admin-only, needs a reason, and a write-off where a balance remains. */
export async function cancelContract(
    id: number,
    cancel_reason: string,
    write_off: boolean
): Promise<FormState> {
    try {
        await apiCallWithRefresh<unknown>(`${CONTRACTS_PATH}/${id}`, "PATCH", {
            status: "cancelled",
            cancel_reason,
            write_off,
        });
    } catch (error) {
        return toFailure(error, new FormData(), 0);
    }

    revalidatePath("/contracts");

    return { ok: true, message: "Contract cancelled.", errors: [], attempt: 0 };
}
