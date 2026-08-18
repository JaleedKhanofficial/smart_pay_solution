export type Role = "admin" | "operator";

export type SessionUser = {
    id: string;
    name: string;
    email: string;
    role: Role;
};

/** Body returned by POST /auth/login and /auth/refresh. */
export type AuthResponse = {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    user: SessionUser;
};

/** SRS §5.4 — exactly two per customer (FR-CUS-03-v2). */
export type Guarantor = {
    id: number;
    customerId: number;
    position: number;
    fullName: string;
    fatherName: string;
    relationship: string;
    cnicNumber: string;
    mobileNumber: string;
    address: string;
    cnicFileId: string | null;
};

/**
 * SRS §5.3. Money arrives as a string: Prisma Decimal keeps exactness.
 * `id` is a sequential integer rather than a UUID — see prisma/schema.prisma.
 */
export type Customer = {
    id: number;
    fullName: string;
    fatherHusbandName: string;
    cnicNumber: string;
    mobileNumber: string;
    address: string;
    occupation: string;
    monthlyIncome: string;
    cnicFileId: string | null;
    guarantors: Guarantor[];
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
};

export type Paginated<T> = {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

/** Columns the register can be ordered by; mirrors the API whitelist. */
export const SORT_FIELDS = [
    "fullName",
    "cnicNumber",
    "mobileNumber",
    "occupation",
    "createdAt",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type CustomerSort = {
    field: SortField;
    dir: SortDirection;
};

export const DEFAULT_SORT: CustomerSort = { field: "createdAt", dir: "desc" };

/** Every filter the customer register accepts, as it appears in the URL. */
export type CustomerFilterValues = {
    search: string;
    occupation: string;
    guarantors: string;
    cnicImage: string;
    addedFrom: string;
    addedTo: string;
};

export const EMPTY_FILTERS: CustomerFilterValues = {
    search: "",
    occupation: "",
    guarantors: "",
    cnicImage: "",
    addedFrom: "",
    addedTo: "",
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
