"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/api/api.repository";
import { apiCallWithRefresh } from "@/lib/api";
import type {
    BinKind,
    ContractRestorePreview,
    FormState,
    RestoreContractBody,
} from "@/types/recycle-bin";
import type { PurgeReturnPreview } from "@/types/investor";

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
        "/investors",
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

/** FR-BIN-02. Funding lines frozen at delete, for the restore dialog. */
export async function loadContractRestorePreview(
    contractId: number
): Promise<ContractRestorePreview | null> {
    try {
        return await apiCallWithRefresh<ContractRestorePreview | null>(
            `${BIN_PATH}/contract/${contractId}/restore-preview`
        );
    } catch {
        return null;
    }
}

/** FR-BIN-03. Capital returning to each funder when a contract is purged. */
export async function loadPurgePreview(
    contractId: number
): Promise<PurgeReturnPreview[]> {
    try {
        return await apiCallWithRefresh<PurgeReturnPreview[]>(
            `${BIN_PATH}/contract/${contractId}/purge-preview`
        );
    } catch {
        return [];
    }
}

/** FR-BIN-02 */
export async function restoreRecord(
    kind: BinKind,
    id: number,
    body?: RestoreContractBody
): Promise<FormState> {
    try {
        await apiCallWithRefresh<void>(
            `${BIN_PATH}/${kind}/${id}/restore`,
            "POST",
            body ?? {}
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
