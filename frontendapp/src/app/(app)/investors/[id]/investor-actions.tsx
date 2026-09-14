"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { downloadInvestorPdf } from "@/lib/investor-pdf";
import type { InvestorDetail } from "@/types/investor";

/**
 * FR-IVT-12. The statement, as a file to hand over.
 *
 * Built from the payload this page already rendered, so what is on screen and
 * what is in the file cannot differ, and no second round trip can return
 * something else in between.
 */
export function InvestorActions({
    investor,
    businessName,
}: {
    investor: InvestorDetail;
    businessName: string;
}) {
    const [failed, setFailed] = useState<string | null>(null);

    function download() {
        setFailed(null);

        try {
            downloadInvestorPdf(investor, businessName);
        } catch (error) {
            // A failed save is silent otherwise: the file simply never appears
            // and the operator is left wondering whether they missed it.
            setFailed(
                error instanceof Error
                    ? error.message
                    : "Could not build the statement."
            );
        }
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <Button onClick={download} stackOnMobile>
                <Icon name="download" className="size-4" />
                Download PDF
            </Button>

            {failed ? <p className="text-xs text-negative">{failed}</p> : null}
        </div>
    );
}
