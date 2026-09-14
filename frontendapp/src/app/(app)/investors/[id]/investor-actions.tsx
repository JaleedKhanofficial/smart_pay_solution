"use client";

import { DownloadPdfButton } from "@/components/download-pdf-button";
import { downloadInvestorPdf } from "@/lib/investor-pdf";
import type { InvestorDetail } from "@/types/investor";

/**
 * FR-IVT-12. The statement, as a file to hand over.
 *
 * Built from the payload this page already rendered, so what is on screen and
 * what is in the file cannot differ.
 */
export function InvestorActions({
    investor,
    businessName,
}: {
    investor: InvestorDetail;
    businessName: string;
}) {
    return (
        <DownloadPdfButton
            build={() => downloadInvestorPdf(investor, businessName)}
        />
    );
}
