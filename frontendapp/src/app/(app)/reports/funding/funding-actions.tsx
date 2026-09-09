"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { downloadFundingReportPdf } from "@/lib/funding-report-pdf";
import type {
    FundingFilterValues,
    FundingReport,
} from "@/types/funding-report";

/**
 * FR-IVT-16. The register as a downloadable PDF.
 *
 * The report is already on the page, so the file is built from what is on
 * screen — the filters you are looking at are the filters the document says it
 * was taken under, and no second round trip can return something different.
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
    const [failed, setFailed] = useState<string | null>(null);

    function download() {
        setFailed(null);

        try {
            downloadFundingReportPdf(report, filters, businessName);
        } catch (error) {
            // A failed save is silent otherwise: the file simply never appears
            // and the operator is left wondering whether they missed it.
            setFailed(
                error instanceof Error
                    ? error.message
                    : "Could not build the PDF."
            );
        }
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <Button
                onClick={download}
                disabled={report.rows.length === 0}
                stackOnMobile
            >
                <Icon name="download" className="size-4" />
                Download PDF
            </Button>

            {failed ? <p className="text-xs text-negative">{failed}</p> : null}
        </div>
    );
}
