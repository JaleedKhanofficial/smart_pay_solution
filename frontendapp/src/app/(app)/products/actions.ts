"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { Category, FormState, Product } from "@/types/product";

const PRODUCTS_PATH = "/products";
const CATEGORIES_PATH = "/product-categories";

const PRODUCT_FIELDS = ["name", "category_id", "status"] as const;

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

function listUrlWithFlash(path: string, message: string): string {
    return `${path}?flash=${encodeURIComponent(message)}`;
}

/** The request body the popup sends for both add and edit. */
function toProductBody(formData: FormData) {
    return {
        name: String(formData.get("name") ?? "").trim(),
        // The select posts a string; the API expects the numeric key.
        category_id: Number(formData.get("category_id") ?? 0),
        status: String(formData.get("status") ?? "Active"),
    };
}

/**
 * The catalogue has no add/edit pages — everything happens in the popup — so
 * this never redirects: doing so would tear the modal's own page out from under
 * it. revalidatePath refreshes the register underneath instead, so the row is
 * up to date by the time the panel closes.
 */
export async function saveProductInline(
    id: number | null,
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;

    try {
        await apiCallWithRefresh<Product>(
            id ? `${PRODUCTS_PATH}/${id}` : PRODUCTS_PATH,
            id ? "PATCH" : "POST",
            toProductBody(formData)
        );
    } catch (error) {
        return toFailure(error, formData, PRODUCT_FIELDS, attempt);
    }

    revalidatePath("/products");

    return {
        ok: true,
        message: id ? "Product updated." : "Product added to the catalogue.",
        errors: [],
        attempt,
    };
}

/** FR-PRD-04. Soft delete; the API refuses with 409 while a contract uses it. */
export async function deleteProduct(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${PRODUCTS_PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error, new FormData(), PRODUCT_FIELDS, 0);
    }

    revalidatePath("/products");

    return { ok: true, message: "Product deleted.", errors: [], attempt: 0 };
}

/** FR-PRD-07. Adds a category, or renames one when given an id. */
export async function saveCategory(
    id: number | null,
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    const attempt = prevState.attempt + 1;
    const name = String(formData.get("name") ?? "").trim();

    try {
        await apiCallWithRefresh<Category>(
            id ? `${CATEGORIES_PATH}/${id}` : CATEGORIES_PATH,
            id ? "PATCH" : "POST",
            { name }
        );
    } catch (error) {
        return toFailure(error, formData, ["name"], attempt);
    }

    // The catalogue shows category names on every row, so both screens change.
    revalidatePath("/products/categories");
    revalidatePath("/products");

    redirect(
        listUrlWithFlash(
            "/products/categories",
            id ? "Category renamed." : "Category added."
        )
    );
}

/**
 * FR-PRD-07. Allowed only while nothing is filed under the category; the API
 * refuses with 409 otherwise, including when the only products referencing it
 * are soft-deleted and still holding the foreign key.
 */
export async function deleteCategory(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${CATEGORIES_PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error, new FormData(), ["name"], 0);
    }

    revalidatePath("/products/categories");
    revalidatePath("/products");

    return { ok: true, message: "Category deleted.", errors: [], attempt: 0 };
}
