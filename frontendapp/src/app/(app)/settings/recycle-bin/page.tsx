import type { Metadata } from "next";
import BinManager from "./bin-manager";
import { apiCall } from "@/lib/api";
import {
    EMPTY_FILTERS,
    type BinFilterValues,
    type BinRow,
    type BinSummary,
} from "@/types/recycle-bin";

export const metadata: Metadata = {
    title: "Recycle Bin · SmartPay Solutions",
    description: "Restore or permanently remove deleted records",
};

type SearchParams = Partial<Record<keyof BinFilterValues, string>>;

/** Module 10 (SRS §4.10). Admin only — the API enforces it and the sidebar
 *  already hides the link for an operator (FR-AUT-06). */
export default async function RecycleBinPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: BinFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof BinFilterValues)[]).map(
                (key) => [key, params[key]?.trim() ?? ""]
            )
        ),
    };

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }

    let rows: BinRow[] = [];
    let loadError: string | null = null;

    try {
        rows = await apiCall<BinRow[]>(
            query.toString()
                ? `/recycle-bin?${query.toString()}`
                : "/recycle-bin"
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load the Recycle Bin: ${error.message}`
                : "Could not load the Recycle Bin.";
    }

    // The counts double as the kind filter, so they are always loaded whole
    // rather than reflecting the current narrowing.
    const summary = await apiCall<BinSummary>("/recycle-bin/summary").catch(
        () => [] as BinSummary
    );

    return (
        <BinManager
            rows={rows}
            summary={summary}
            filters={filters}
            loadError={loadError}
        />
    );
}
