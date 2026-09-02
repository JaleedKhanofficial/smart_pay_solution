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
import type { Invoice } from "@/types/invoice";
import type { LossPreview } from "@/types/investor";

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

/** FR-CON-11. One investor's stake, as the API validates it. */
type FundingLine = {
    investor_id: number;
    amount: number;
};

/** The full create/update payload: the terms, plus who the deal is with. */
type Terms = Partial<PreviewTerms> & {
    customer_id?: number;
    product_id?: number;
    notes?: string;
    fundings?: FundingLine[];
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

/**
 * FR-CON-11. The funding rows, read from four index-aligned lists.
 *
 * The panel posts every field on every row, blanks included, precisely so the
 * indices line up — an omitted optional would shift each later row's reason
 * onto the wrong investor, which is exactly the sort of silent mismatch this
 * form must not produce.
 *
 * A row with no investor or no amount is a half-filled line the operator left
 * behind, not an instruction; it is dropped rather than sent as a zero.
 */
function toFundings(formData: FormData): FundingLine[] {
    const ids = formData.getAll("funding_investor_id");
    const amounts = formData.getAll("funding_amount");

    const lines: FundingLine[] = [];

    ids.forEach((raw, index) => {
        const investor_id = Number(raw);
        const amount = Number(amounts[index] ?? "");

        if (!Number.isFinite(investor_id) || investor_id < 1) return;
        if (!Number.isFinite(amount) || amount <= 0) return;

        lines.push({ investor_id, amount });
    });

    return lines;
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

    // Create only: the API refuses fundings on a PATCH (FR-CON-15), and the
    // form does not render the panel on the edit path either.
    if (id === null) {
        const fundings = toFundings(formData);

        if (fundings.length > 0) terms.fundings = fundings;
    }

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
    //
    // A create carries the new id rather than a flash message: the register
    // asks whether to print the agreement, and that dialog is the write's
    // acknowledgement (NFR-14.6). An update keeps the flash — there is nothing
    // to print that was not printable a moment ago.
    redirect(
        id
            ? `/contracts?flash=${encodeURIComponent("Contract updated.")}`
            : `/contracts?created=${saved.contract.id}`
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

/**
 * BR-20 / FR-CON-16. What a write-off or a purge would cost this contract's
 * funders, so the confirmation can name them and the amounts.
 *
 * Admin-only on the API. An operator's 403 yields an empty list, which reads
 * as "no funders to warn about" — and an operator cannot cancel a contract
 * anyway, so the dialog they would see it in is out of reach.
 */
export async function loadLossPreview(id: number): Promise<LossPreview[]> {
    try {
        return await apiCallWithRefresh<LossPreview[]>(
            `${CONTRACTS_PATH}/${id}/loss-preview`
        );
    } catch {
        return [];
    }
}

/**
 * FR-INV-06. The agreement payload, for building the PDF without opening the
 * printed page.
 *
 * The register and the just-created prompt both offer the download, and
 * neither has the invoice to hand — this is the one read they need.
 */
export async function loadInvoice(
    id: number
): Promise<{ ok: true; invoice: Invoice } | { ok: false; message: string }> {
    try {
        return {
            ok: true,
            invoice: await apiCallWithRefresh<Invoice>(
                `${CONTRACTS_PATH}/${id}/invoice`
            ),
        };
    } catch (error) {
        return {
            ok: false,
            message:
                error instanceof ApiError
                    ? error.message
                    : "Could not load the agreement.",
        };
    }
}
