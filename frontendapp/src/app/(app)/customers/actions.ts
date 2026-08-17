"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { Customer, FormState } from "@/types/customer";

const CUSTOMERS_PATH = "/customers";

type CustomerPayload = {
    fullName: string;
    fatherHusbandName: string;
    cnicNumber: string;
    mobileNumber: string;
    address: string;
    occupation: string;
    monthlyIncome: number;
};

function toPayload(formData: FormData): CustomerPayload {
    const text = (key: string) => String(formData.get(key) ?? "").trim();

    return {
        fullName: text("fullName"),
        fatherHusbandName: text("fatherHusbandName"),
        cnicNumber: text("cnicNumber"),
        mobileNumber: text("mobileNumber"),
        address: text("address"),
        occupation: text("occupation"),
        monthlyIncome: Number(text("monthlyIncome") || 0),
    };
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

export async function createCustomer(
    _prevState: FormState,
    formData: FormData
): Promise<FormState> {
    try {
        await apiCallWithRefresh<Customer>(
            CUSTOMERS_PATH,
            "POST",
            toPayload(formData)
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    return { ok: true, message: "Customer created.", errors: [] };
}

export async function updateCustomer(
    id: string,
    _prevState: FormState,
    formData: FormData
): Promise<FormState> {
    try {
        await apiCallWithRefresh<Customer>(
            `${CUSTOMERS_PATH}/${id}`,
            "PATCH",
            toPayload(formData)
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    return { ok: true, message: "Customer updated.", errors: [] };
}

export async function deleteCustomer(id: string): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(`${CUSTOMERS_PATH}/${id}`, "DELETE");
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    return { ok: true, message: "Customer deleted.", errors: [] };
}
