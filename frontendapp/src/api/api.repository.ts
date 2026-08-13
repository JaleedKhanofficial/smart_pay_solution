class ApiRepository {
    constructor(baseURL = "") {
        this.baseURL = baseURL;
    }

    // Default Headers
    getHeaders(isJson = true) {
        const headers = {};

        if (isJson) {
            headers["Content-Type"] = "application/json";
        }

        const token = localStorage.getItem("token"); // Change according to your app

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        return headers;
    }

    // Common Request Method
    async request(url, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                headers: {
                    ...this.getHeaders(),
                    ...options.headers,
                },
                ...options,
            });

            let data;

            const contentType = response.headers.get("content-type");

            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw {
                    status: response.status,
                    message: data.message || response.statusText,
                    data,
                };
            }

            return data;
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }

    // GET
    get(url) {
        return this.request(url, {
            method: "GET",
        });
    }

    // GET with Query Parameters
    getWithParams(url, params = {}) {
        const query = new URLSearchParams(params).toString();

        return this.request(`${url}?${query}`, {
            method: "GET",
        });
    }

    // POST
    post(url, body = {}) {
        return this.request(url, {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    // PUT
    put(url, body = {}) {
        return this.request(url, {
            method: "PUT",
            body: JSON.stringify(body),
        });
    }

    // PATCH
    patch(url, body = {}) {
        return this.request(url, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
    }

    // DELETE
    delete(url) {
        return this.request(url, {
            method: "DELETE",
        });
    }

    // Upload File
    upload(url, formData) {
        const token = localStorage.getItem("token");

        return this.request(url, {
            method: "POST",
            headers: token
                ? {
                      Authorization: `Bearer ${token}`,
                  }
                : {},
            body: formData,
        });
    }
}

export const apiRepository = new ApiRepository(
    "https://your-api-url.com/api"
);