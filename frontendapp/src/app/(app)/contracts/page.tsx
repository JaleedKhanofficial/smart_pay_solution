import type { Metadata } from "next";
import ContractsManager from "./contracts-manager";
import { loadPickers } from "./lookups";
import { apiCall } from "@/lib/api";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    SORT_FIELDS,
    type Contract,
    type ContractFilterValues,
    type ContractSort,
    type Paginated,
    type SortField,
} from "@/types/contract";
import type { SessionUser } from "@/types/customer";

export const metadata: Metadata = {
    title: "Contracts · SmartPay Solutions",
    description: "Installment agreements",
};

const EMPTY_PAGE: Paginated<Contract> = {
    data: [],
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
};

type SearchParams = Partial<Record<keyof ContractFilterValues, string>> & {
    page?: string;
    flash?: string;
    sort?: string;
    dir?: string;
};

/** Anything unrecognised falls back to the default rather than erroring. */
function readSort(params: SearchParams): ContractSort {
    const field = SORT_FIELDS.includes(params.sort as SortField)
        ? (params.sort as SortField)
        : DEFAULT_SORT.field;

    const dir =
        params.dir === "asc" || params.dir === "desc"
            ? params.dir
            : DEFAULT_SORT.dir;

    return { field, dir };
}

export default async function ContractsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: ContractFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof ContractFilterValues)[]).map(
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

    let contracts = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        contracts = await apiCall<Paginated<Contract>>(
            `/contracts?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load contracts: ${error.message}`
                : "Could not load contracts.";
    }

    const { customers, products } = await loadPickers();

    // NFR-15: cancelling is an admin action. The API enforces it regardless;
    // this only keeps a button that would 403 off an operator's screen.
    const user = await apiCall<SessionUser>("/auth/me").catch(() => null);

    return (
        <ContractsManager
            page={contracts}
            filters={filters}
            sort={sort}
            customers={customers}
            products={products}
            isAdmin={user?.role === "admin"}
            flash={params.flash}
            loadError={loadError}
        />
    );
}
