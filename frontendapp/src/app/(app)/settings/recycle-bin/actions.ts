"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type { BinKind, FormState } from "@/types/recycle-bin";

const BIN_PATH = "/recycle-bin";

/** Restoring or purging touches records every other register reads. */
function revalidateEverything(): void {
    for (const path of [
        "/settings/recycle-bin",
        "/customers",
        "/products",
        "/contracts",
        "/payments",
        "/settings/users",
        "/dashboard",
    ]) {
        revalidatePath(path);
    }
}

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

/** FR-BIN-02 */
export async function restoreRecord(
    kind: BinKind,
    id: number
): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(
            `${BIN_PATH}/${kind}/${id}/restore`,
            "POST"
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidateEverything();

    return {
        ok: true,
        message: "Restored and back in service.",
        errors: [],
        attempt: 0,
    };
}

/**
 * FR-BIN-03. Permanent. The typed confirmation happens in the dialog before
 * this is called; the server independently refuses anything not already
 * deleted, and anything still holding dependants.
 */
export async function purgeRecord(
    kind: BinKind,
    id: number
): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(
            `${BIN_PATH}/${kind}/${id}/purge`,
            "DELETE"
        );
    } catch (error) {
        return toFailure(error);
    }

    revalidateEverything();

    return {
        ok: true,
        message: "Purged. That record is gone for good.",
        errors: [],
        attempt: 0,
    };
}
