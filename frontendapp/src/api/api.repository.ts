export type RequestOptions = Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
};

/**
 * Nest answers an unknown route with `Cannot DELETE /api/v1/…`, which is
 * accurate and useless to whoever is reading the dialog. In practice it means
 * one thing: the API process is older than the code it is meant to be running,
 * because `start:prod` loads `dist/main` once and never reloads.
 */
const UNKNOWN_ROUTE = /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \//;

function explain(status: number, message: string): string {
    if (status === 404 && UNKNOWN_ROUTE.test(message)) {
        return "This action is missing from the running API — it is serving an older build. Restart it (npm run start:dev in backend/) and try again.";
    }

    return message;
}

export class ApiError extends Error {
    readonly status: number;
    readonly data: unknown;

    constructor(status: number, message: string, data: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }

    /**
     * Nest's ValidationPipe replies with `message: string[]`. Everything else
     * (404, 409, network errors) has a single message.
     */
    get messages(): string[] {
        const payload = this.data as { message?: unknown } | null;

        if (payload && Array.isArray(payload.message)) {
            return payload.message.map(String);
        }

        return [this.message];
    }
}

class ApiRepository {
    private readonly baseURL: string;

    constructor(baseURL = "") {
        this.baseURL = baseURL;
    }

    // Default Headers
    getHeaders(isJson = true): Record<string, string> {
        const headers: Record<string, string> = {};

        if (isJson) {
            headers["Content-Type"] = "application/json";
        }

        // Guarded so the repository can also be used on the server
        // (Server Components / Server Actions), where there is no localStorage.
        const token =
            typeof window === "undefined"
                ? null
                : window.localStorage.getItem("token"); // Change according to your app

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        return headers;
    }

    // Common Request Method
    async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
        const { headers, ...rest } = options;

        // FormData must set its own multipart boundary, so the JSON content
        // type is dropped for those requests.
        const isMultipart =
            typeof FormData !== "undefined" && rest.body instanceof FormData;

        const response = await fetch(`${this.baseURL}${url}`, {
            cache: "no-store",
            ...rest,
            headers: {
                ...this.getHeaders(!isMultipart),
                ...headers,
            },
        });

        let data: unknown;

        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            const message = (data as { message?: unknown })?.message;

            const text = Array.isArray(message)
                ? message.join(", ")
                : typeof message === "string" && message
                  ? message
                  : response.statusText;

            // `data` keeps the raw payload, so the original wording is still
            // there for anyone debugging.
            throw new ApiError(response.status, explain(response.status, text), data);
        }

        return data as T;
    }

    // GET
    get<T>(url: string) {
        return this.request<T>(url, {
            method: "GET",
        });
    }

    // GET with Query Parameters
    getWithParams<T>(url: string, params: Record<string, string> = {}) {
        const query = new URLSearchParams(params).toString();

        return this.request<T>(`${url}?${query}`, {
            method: "GET",
        });
    }

    // POST
    post<T>(url: string, body: unknown = {}) {
        return this.request<T>(url, {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    // PUT
    put<T>(url: string, body: unknown = {}) {
        return this.request<T>(url, {
            method: "PUT",
            body: JSON.stringify(body),
        });
    }

    // PATCH
    patch<T>(url: string, body: unknown = {}) {
        return this.request<T>(url, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
    }

    // DELETE
    delete<T>(url: string) {
        return this.request<T>(url, {
            method: "DELETE",
        });
    }

    // Upload File
    upload<T>(url: string, formData: FormData) {
        // No Content-Type header: the browser sets the multipart boundary.
        return this.request<T>(url, {
            method: "POST",
            headers: this.getHeaders(false),
            body: formData,
        });
    }
}

export const apiRepository = new ApiRepository(
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"
);
