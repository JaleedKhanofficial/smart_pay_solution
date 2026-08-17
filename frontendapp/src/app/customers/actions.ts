"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiRepository } from "@/api/api.repository";
import type {
    Customer,
    CustomerFormState,
    CustomerPayload,
} from "@/types/customer";

const CUSTOMERS_PATH = "/customers";

function toPayload(formData: FormData): CustomerPayload {
    return {
        name: String(formData.get("name") ?? "").trim(),
        address: String(formData.get("address") ?? "").trim(),
        phoneNumber: String(formData.get("phoneNumber") ?? "").trim(),
        cnic: String(formData.get("cnic") ?? "").trim(),
    };
}

function toFailure(error: unknown): CustomerFormState {
    if (error instanceof ApiError) {
        return {
            ok: false,
            message: error.message,
            errors: error.messages,
        };
    }

    return {
        ok: false,
        message:
            "Could not reach the API. Is the NestJS server running on port 5000?",
        errors: [],
    };
}

export async function createCustomer(
    _prevState: CustomerFormState,
    formData: FormData
): Promise<CustomerFormState> {
    try {
        await apiRepository.post<Customer>(CUSTOMERS_PATH, toPayload(formData));
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    return { ok: true, message: "Customer created.", errors: [] };
}

export async function updateCustomer(
    id: string,
    _prevState: CustomerFormState,
    formData: FormData
): Promise<CustomerFormState> {
    try {
        await apiRepository.patch<Customer>(
            `${CUSTOMERS_PATH}/${id}`,
            toPayload(formData)
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    return { ok: true, message: "Customer updated.", errors: [] };
}

export async function deleteCustomer(
    id: string
): Promise<CustomerFormState> {
    try {
        await apiRepository.delete<void>(`${CUSTOMERS_PATH}/${id}`);
    } catch (error) {
        return toFailure(error);
    }

    revalidatePath("/customers");

    return { ok: true, message: "Customer deleted.", errors: [] };
}
