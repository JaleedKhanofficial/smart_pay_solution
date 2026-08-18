import type { Metadata } from "next";
import CustomersManager from "./customers-manager";
import { apiCall } from "@/lib/api";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    SORT_FIELDS,
    type Customer,
    type CustomerFilterValues,
    type CustomerSort,
    type Paginated,
    type SortField,
} from "@/types/customer";

export const metadata: Metadata = {
    title: "Customers · SmartPay Solutions",
    description: "Manage customer records",
};

const EMPTY_PAGE: Paginated<Customer> = {
    data: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
};

type SearchParams = Partial<Record<keyof CustomerFilterValues, string>> & {
    page?: string;
    flash?: string;
    sort?: string;
    dir?: string;
};

/** Anything unrecognised falls back to the default rather than erroring. */
function readSort(params: SearchParams): CustomerSort {
    const field = SORT_FIELDS.includes(params.sort as SortField)
        ? (params.sort as SortField)
        : DEFAULT_SORT.field;

    const dir = params.dir === "asc" || params.dir === "desc"
        ? params.dir
        : DEFAULT_SORT.dir;

    return { field, dir };
}

export default async function CustomersPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: CustomerFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof CustomerFilterValues)[]).map(
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

    let customers = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        customers = await apiCall<Paginated<Customer>>(
            `/customers?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load customers: ${error.message}`
                : "Could not load customers.";
    }

    // Drives the occupation dropdown, so it can only ever offer values that
    // actually exist in the register.
    const occupations = await apiCall<string[]>(
        "/customers/occupations"
    ).catch(() => [] as string[]);

    return (
        <CustomersManager
            page={customers}
            filters={filters}
            sort={sort}
            occupations={occupations}
            flash={params.flash}
            loadError={loadError}
        />
    );
}
