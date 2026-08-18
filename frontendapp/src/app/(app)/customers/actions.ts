"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh, apiSendForm } from "@/lib/api";
import type { Customer, FormState } from "@/types/customer";

const CUSTOMERS_PATH = "/customers";

const SCALAR_FIELDS = [
    "fullName",
    "fatherHusbandName",
    "cnicNumber",
    "mobileNumber",
    "address",
    "occupation",
    "monthlyIncome",
] as const;

const UPLOAD_FIELDS = [
    "customerCnic",
    "guarantor1Cnic",
    "guarantor2Cnic",
] as const;

function guarantorFrom(formData: FormData, position: 1 | 2) {
    const text = (suffix: string) =>
        String(formData.get(`g${position}${suffix}`) ?? "").trim();

    return {
        position,
        fullName: text("FullName"),
        fatherName: text("FatherName"),
        relationship: text("Relationship"),
        cnicNumber: text("CnicNumber"),
        mobileNumber: text("MobileNumber"),
        address: text("Address"),
    };
}

/**
 * Rebuilds the browser's FormData into the API's shape: scalars, the two
 * guarantors as a JSON field, and only the images the user actually picked
 * (an untouched file input keeps the stored image — FR-CUS-07).
 */
function toApiForm(formData: FormData): FormData {
    const form = new FormData();

    for (const field of SCALAR_FIELDS) {
        form.set(field, String(formData.get(field) ?? "").trim());
    }

    form.set(
        "guarantors",
        JSON.stringify([
            guarantorFrom(formData, 1),
            guarantorFrom(formData, 2),
        ])
    );

    for (const field of UPLOAD_FIELDS) {
        const file = formData.get(field);

        if (file instanceof File && file.size > 0) {
            form.set(field, file);
        }
    }

    return form;
}

function toFailure(error: unknown): FormState {
    if (error instanceof ApiError) {
        return { ok: false, message: error.message, errors: error.messages };
    }

    return {
        ok: false,
        message:
            "Could not reach the API. Is the NestJS server running on port 5000?",
        errors: [],
    };
}

function listUrlWithFlash(message: string): string {
    return `/customers?flash=${encodeURIComponent(message)}`;
}

export async function saveCustomer(
    id: number | null,
    _prevState: FormState,
    formData: FormData
): Promise<FormState> {
    try {
        await apiSendForm<Customer>(
            id ? `${CUSTOMERS_PATH}/${id}` : CUSTOMERS_PATH,
            id ? "PATCH" : "POST",
            toApiForm(formData)
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    // redirect() throws a control-flow signal, so it must sit outside the try.
    redirect(
        listUrlWithFlash(id ? "Customer updated." : "Customer created.")
    );
}

export async function deleteCustomer(id: number): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${CUSTOMERS_PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    return { ok: true, message: "Customer deleted.", errors: [] };
}
