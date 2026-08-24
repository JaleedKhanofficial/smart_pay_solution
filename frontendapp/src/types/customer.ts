export type Role = "admin" | "operator";

export type SessionUser = {
    /** Sequential, like every other key in the database. */
    id: number;
    name: string;
    email: string;
    role: Role;
};

/** Body returned by POST /auth/login and /auth/refresh. */
export type AuthResponse = {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    user: SessionUser;
};

/** SRS §5.4 — exactly two per customer (FR-CUS-03-v2). */
export type Guarantor = {
    id: number;
    customer_id: number;
    position: number;
    full_name: string;
    father_name: string;
    relationship: string;
    cnic_number: string;
    mobile_number: string;
    address: string;
    cnic_file_id: string | null;
};

/**
 * SRS §5.3. Money arrives as a string: PostgreSQL `decimal` is read as one, and
 * keeping it that way means no figure is ever rounded through a float.
 * `id` is a sequential integer rather than a UUID — see
 * backend/src/database/entities/customer.entity.ts.
 */
export type Customer = {
    id: number;
    full_name: string;
    father_husband_name: string;
    cnic_number: string;
    mobile_number: string;
    address: string;
    occupation: string;
    monthly_income: string;
    cnic_file_front_id: string | null;
    cnic_file_back_id: string | null;
    guarantors: Guarantor[];
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type Paginated<T> = {
    data: T[];
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
};

/** Columns the register can be ordered by; mirrors the API whitelist. */
export const SORT_FIELDS = [
    "full_name",
    "cnic_number",
    "mobile_number",
    "occupation",
    "created_at",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type CustomerSort = {
    field: SortField;
    dir: SortDirection;
};

export const DEFAULT_SORT: CustomerSort = { field: "created_at", dir: "desc" };

/** Every filter the customer register accepts, as it appears in the URL. */
export type CustomerFilterValues = {
    search: string;
    occupation: string;
    guarantors: string;
    cnic_image: string;
    added_from: string;
    added_to: string;
};

export const EMPTY_FILTERS: CustomerFilterValues = {
    search: "",
    occupation: "",
    guarantors: "",
    cnic_image: "",
    added_from: "",
    added_to: "",
};

export type FormState = {
    ok: boolean;
    message: string | null;
    errors: string[];
    /**
     * React 19 resets an uncontrolled form once its action finishes, whether or
     * not it succeeded, so a rejected submission would wipe everything the user
     * typed. The values are echoed back here and re-seeded into the fields.
     */
    values?: Record<string, string>;
    /** Bumped per submission so the form knows to re-apply those values. */
    attempt: number;
};

export const EMPTY_FORM_STATE: FormState = {
    ok: false,
    message: null,
    errors: [],
    attempt: 0,
};
