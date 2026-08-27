import type { Metadata } from "next";
import UsersManager from "./users-manager";
import { apiCall } from "@/lib/api";
import type { SessionUser } from "@/types/customer";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    SORT_FIELDS,
    type Paginated,
    type SortField,
    type User,
    type UserFilterValues,
    type UserSort,
} from "@/types/user";

export const metadata: Metadata = {
    title: "Users · SmartPay Solutions",
    description: "Staff accounts and roles",
};

const EMPTY_PAGE: Paginated<User> = {
    data: [],
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
};

type SearchParams = Partial<Record<keyof UserFilterValues, string>> & {
    page?: string;
    sort?: string;
    dir?: string;
};

function readSort(params: SearchParams): UserSort {
    const field = SORT_FIELDS.includes(params.sort as SortField)
        ? (params.sort as SortField)
        : DEFAULT_SORT.field;

    const dir =
        params.dir === "asc" || params.dir === "desc"
            ? params.dir
            : DEFAULT_SORT.dir;

    return { field, dir };
}

/** Module 9 (SRS §4.9). Admin only — the API enforces it and the sidebar
 *  already hides the link for an operator (FR-AUT-06). */
export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: UserFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof UserFilterValues)[]).map(
                (key) => [key, params[key]?.trim() ?? ""]
            )
        ),
    };

    const page = Math.max(1, Number(params.page ?? 1) || 1);
    const sort = readSort(params);

    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }
    query.set("sort", sort.field);
    query.set("dir", sort.dir);

    let users = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        users = await apiCall<Paginated<User>>(`/users?${query.toString()}`);
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load users: ${error.message}`
                : "Could not load users.";
    }

    // FR-USR-03: the screen needs to know who is signed in, so it can leave off
    // the controls they are not allowed to use on themselves.
    const self = await apiCall<SessionUser>("/auth/me").catch(() => null);

    return (
        <UsersManager
            page={users}
            filters={filters}
            sort={sort}
            selfId={self?.id ?? 0}
            loadError={loadError}
        />
    );
}
