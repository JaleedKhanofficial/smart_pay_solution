import type { Metadata } from "next";
import PaymentsManager from "./payments-manager";
import { apiCall } from "@/lib/api";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    SORT_FIELDS,
    type CollectableContract,
    type Paginated,
    type Payment,
    type PaymentFilterValues,
    type PaymentSort,
    type SortField,
} from "@/types/payment";

export const metadata: Metadata = {
    title: "Payments · SmartPay Solutions",
    description: "Collections against installment contracts",
};

const EMPTY_PAGE: Paginated<Payment> = {
    data: [],
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
};

type SearchParams = Partial<Record<keyof PaymentFilterValues, string>> & {
    page?: string;
    flash?: string;
    sort?: string;
    dir?: string;
};

/** Anything unrecognised falls back to the default rather than erroring. */
function readSort(params: SearchParams): PaymentSort {
    const field = SORT_FIELDS.includes(params.sort as SortField)
        ? (params.sort as SortField)
        : DEFAULT_SORT.field;

    const dir =
        params.dir === "asc" || params.dir === "desc"
            ? params.dir
            : DEFAULT_SORT.dir;

    return { field, dir };
}

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: PaymentFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof PaymentFilterValues)[]).map(
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

    let payments = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        payments = await apiCall<Paginated<Payment>>(
            `/payments?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load payments: ${error.message}`
                : "Could not load payments.";
    }

    // FR-PAY-02 / FR-PAY-03. The picker and every prefill figure in one call,
    // so choosing a contract in the form costs no round trip.
    const collectable = await apiCall<CollectableContract[]>(
        "/payments/collectable"
    ).catch(() => [] as CollectableContract[]);

    return (
        <PaymentsManager
            page={payments}
            filters={filters}
            sort={sort}
            collectable={collectable}
            flash={params.flash}
            loadError={loadError}
        />
    );
}
