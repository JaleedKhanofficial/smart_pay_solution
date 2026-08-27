import type { Metadata } from "next";
import AuditManager from "./audit-manager";
import { apiCall } from "@/lib/api";
import {
    EMPTY_FILTERS,
    type AuditEntry,
    type AuditFacets,
    type AuditFilterValues,
    type Paginated,
} from "@/types/audit";

export const metadata: Metadata = {
    title: "Audit log · SmartPay Solutions",
    description: "Append-only record of every write",
};

const EMPTY_PAGE: Paginated<AuditEntry> = {
    data: [],
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
};

const NO_FACETS: AuditFacets = { entities: [], actions: [], actors: [] };

type SearchParams = Partial<Record<keyof AuditFilterValues, string>> & {
    page?: string;
};

/** Module 11 (SRS §4.11). Admin only, and read only — there is no write path
 *  to this data through the application at all (FR-AUD-03). */
export default async function AuditPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: AuditFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof AuditFilterValues)[]).map(
                (key) => [key, params[key]?.trim() ?? ""]
            )
        ),
    };

    const page = Math.max(1, Number(params.page ?? 1) || 1);

    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }

    let entries = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        entries = await apiCall<Paginated<AuditEntry>>(
            `/audit?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load the audit log: ${error.message}`
                : "Could not load the audit log.";
    }

    // The dropdowns are built from what the log actually holds, so a new action
    // becomes filterable the first time it is recorded.
    const facets = await apiCall<AuditFacets>("/audit/facets").catch(
        () => NO_FACETS
    );

    return (
        <AuditManager
            page={entries}
            filters={filters}
            facets={facets}
            loadError={loadError}
        />
    );
}
