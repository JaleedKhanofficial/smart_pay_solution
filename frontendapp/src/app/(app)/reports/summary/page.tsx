import type { Metadata } from "next";
import SummaryManager from "./summary-manager";
import { apiCall } from "@/lib/api";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    SORT_FIELDS,
    type SortField,
    type Summary,
    type SummaryFilterValues,
    type SummarySort,
} from "@/types/report";

export const metadata: Metadata = {
    title: "Summary report · SmartPay Solutions",
    description: "The internal workbook",
};

const EMPTY: Summary = {
    rows: { data: [], page: 1, page_size: 50, total: 0, total_pages: 1 },
    totals: {
        deals: 0,
        completed: 0,
        in_progress: 0,
        total_sale: "0.00",
        total_outstanding: "0.00",
        total_paid: "0.00",
        mature_profit: "0.00",
        unmatured_profit: "0.00",
        total_profit: "0.00",
        average_markup_pct: "0.00",
        net_balance: "0.00",
    },
    capital: { total: "0.00", entries: [] },
    expenses: { total: "0.00", entries: [] },
    deal_types: [],
    missing: { no_mobile: [], no_cnic: [] },
    top_performer: null,
    generated_at: new Date().toISOString(),
};

type SearchParams = Partial<Record<keyof SummaryFilterValues, string>> & {
    page?: string;
    sort?: string;
    dir?: string;
};

function readSort(params: SearchParams): SummarySort {
    const field = SORT_FIELDS.includes(params.sort as SortField)
        ? (params.sort as SortField)
        : DEFAULT_SORT.field;

    const dir =
        params.dir === "asc" || params.dir === "desc"
            ? params.dir
            : DEFAULT_SORT.dir;

    return { field, dir };
}

/**
 * Module 8 (SRS §4.8). Admin only — the deal rows would be readable by an
 * operator, but capital, expenses and net balance are the business's own
 * position (NFR-15), and they are on the same screen.
 */
export default async function SummaryPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: SummaryFilterValues = {
        ...EMPTY_FILTERS,
        search: params.search?.trim() ?? "",
        scope: params.scope?.trim() || "all",
    };

    const page = Math.max(1, Number(params.page ?? 1) || 1);
    const sort = readSort(params);

    const query = new URLSearchParams({ page: String(page) });
    if (filters.search) query.set("search", filters.search);
    if (filters.scope !== "all") query.set("scope", filters.scope);
    query.set("sort", sort.field);
    query.set("dir", sort.dir);

    let summary = EMPTY;
    let loadError: string | null = null;

    try {
        summary = await apiCall<Summary>(
            `/reports/summary?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load the report: ${error.message}`
                : "Could not load the report.";
    }

    return (
        <SummaryManager
            summary={summary}
            filters={filters}
            sort={sort}
            loadError={loadError}
        />
    );
}
