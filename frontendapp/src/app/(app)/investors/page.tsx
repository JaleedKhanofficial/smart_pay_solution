import type { Metadata } from "next";
import InvestorsManager from "./investors-manager";
import { apiCall } from "@/lib/api";
import {
    EMPTY_FILTERS,
    type InvestorFilterValues,
    type InvestorOption,
    type InvestorRow,
    type Paginated,
} from "@/types/investor";
import type { BusinessIdentity, Setting } from "@/types/setting";

export const metadata: Metadata = {
    title: "Investors · SmartPay Solutions",
    description: "Investor capital",
};

const EMPTY_PAGE: Paginated<InvestorRow> = {
    data: [],
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
};

type SearchParams = Partial<Record<keyof InvestorFilterValues, string>> & {
    page?: string;
};

/** Module 13. Admin only — FR-IVT-16 enforces it at the API, and the sidebar
 *  hides the link for an operator (FR-AUT-06). */
export default async function InvestorsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: InvestorFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof InvestorFilterValues)[]).map(
                (key) => [key, params[key]?.trim() ?? ""]
            )
        ),
    };

    const page = Math.max(1, Number(params.page ?? 1) || 1);

    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }

    let investors = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        investors = await apiCall<Paginated<InvestorRow>>(
            `/investors?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load investors: ${error.message}`
                : "Could not load investors.";
    }

    /**
     * Two extra reads, both of which the page still renders without.
     *
     * `options` is every investor for the picker — the page in view is not
     * enough, or picking someone on page two would be impossible.
     *
     * `everyMatch` is what the PDF exports: the whole filtered set rather than
     * the 25 rows on screen, because a register export that stopped at the
     * page boundary would be a worse document than no export. It is capped at
     * the API's own 100, and the footer says so when it bites.
     */
    const exportQuery = new URLSearchParams({ page: "1", page_size: "100" });
    for (const [key, value] of Object.entries(filters)) {
        if (value) exportQuery.set(key, value);
    }

    const [options, everyMatch, business] = await Promise.all([
        apiCall<InvestorOption[]>("/investors/lookup").catch(
            () => [] as InvestorOption[]
        ),
        apiCall<Paginated<InvestorRow>>(
            `/investors?${exportQuery.toString()}`
        ).catch(() => EMPTY_PAGE),
        apiCall<Setting[]>("/settings")
            .then(
                (settings) =>
                    settings.find((entry) => entry.key === "business_identity")
                        ?.value as BusinessIdentity | undefined
            )
            .catch(() => undefined),
    ]);

    return (
        <InvestorsManager
            page={investors}
            filters={filters}
            loadError={loadError}
            options={options}
            exportRows={everyMatch.data}
            exportOmitted={Math.max(0, everyMatch.total - everyMatch.data.length)}
            businessName={business?.name ?? "SmartPay Solutions"}
        />
    );
}
