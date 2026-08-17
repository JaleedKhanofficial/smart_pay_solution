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

/** SRS §5.3. Money arrives as a string: Prisma Decimal keeps exactness. */
export type Customer = {
    id: string;
    fullName: string;
    fatherHusbandName: string;
    cnicNumber: string;
    mobileNumber: string;
    address: string;
    occupation: string;
    monthlyIncome: string;
    cnicFileId: string | null;
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

export type FormState = {
    ok: boolean;
    message: string | null;
    errors: string[];
};

export const EMPTY_FORM_STATE: FormState = {
    ok: false,
    message: null,
    errors: [],
};
