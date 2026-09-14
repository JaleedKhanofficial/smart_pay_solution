"use client";

import { DownloadPdfButton } from "@/components/download-pdf-button";
import { downloadFundingReportPdf } from "@/lib/funding-report-pdf";
import type {
    FundingFilterValues,
    FundingReport,
} from "@/types/funding-report";

/**
 * FR-IVT-16. The register as a downloadable PDF.
 *
 * Built from the report already on the page, so the filters you are looking at
 * are the filters the document says it was taken under, and no second round
 * trip can return something different.
 */
export function FundingActions({
    report,
    filters,
    businessName,
}: {
    report: FundingReport;
    filters: FundingFilterValues;
    businessName: string;
}) {
    return (
        <DownloadPdfButton
            disabled={report.rows.length === 0}
            build={() =>
                downloadFundingReportPdf(report, filters, businessName)
            }
        />
    );
}
