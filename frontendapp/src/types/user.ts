import type { FormState, Paginated, Role } from "./customer";

export type UserStatus = "active" | "disabled";

/**
 * SRS §5.1. `password_hash` is absent by construction on the server — every
 * user response goes through a mapper that never carries it, so there is
 * nothing for this type to omit.
 */
export type User = {
    id: number;
    name: string;
    email: string;
    role: Role;
    status: UserStatus;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

/** Columns the register can be ordered by; mirrors the API whitelist. */
export const SORT_FIELDS = [
    "name",
    "email",
    "role",
    "status",
    "last_login_at",
    "created_at",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";
export type UserSort = { field: SortField; dir: SortDirection };

export const DEFAULT_SORT: UserSort = { field: "name", dir: "asc" };

export type UserFilterValues = {
    search: string;
    role: string;
    status: string;
};

export const EMPTY_FILTERS: UserFilterValues = {
    search: "",
    role: "",
    status: "",
};

/** NFR-04 / FR-USR-02-v2. Mirrors the server's floor. */
export const MIN_PASSWORD_LENGTH = 10;

export type { FormState, Paginated, Role };
