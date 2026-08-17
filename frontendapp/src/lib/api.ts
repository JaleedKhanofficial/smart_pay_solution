import { ApiError, apiRepository } from "@/api/api.repository";
import { readTokens, refreshSession } from "./session";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

function bearer(token?: string): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * One authenticated call to the NestJS API. Throws ApiError(401) when the
 * access token is missing or rejected — proxy.ts normally renews it before a
 * page renders, so that only happens if the token was revoked mid-session.
 */
export async function apiCall<T>(
    path: string,
    method: Method = "GET",
    body?: unknown
): Promise<T> {
    const { access } = await readTokens();

    return apiRepository.request<T>(path, {
        method,
        headers: bearer(access),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

/**
 * For Server Actions: retries once through a token refresh if the access token
 * expired mid-action. Only safe here, because actions may write cookies.
 */
export async function apiCallWithRefresh<T>(
    path: string,
    method: Method = "GET",
    body?: unknown
): Promise<T> {
    try {
        return await apiCall<T>(path, method, body);
    } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
            throw error;
        }

        if (!(await refreshSession())) {
            throw error;
        }

        return apiCall<T>(path, method, body);
    }
}
