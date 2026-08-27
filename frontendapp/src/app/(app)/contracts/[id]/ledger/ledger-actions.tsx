"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { downloadLedgerPdf } from "@/lib/ledger-pdf";
import type { Ledger } from "@/types/ledger";

/**
 * FR-REC-07. Two ways out of the ledger, and they are not the same thing.
 *
 * **Download** builds a PDF from the ledger data — crisp text, small file,
 * named for the customer, identical on every machine.
 *
 * **Print** hands the page to the browser, which prints what is on screen and
 * also offers Save as PDF. Kept because it is the honest "what I see" copy,
 * and because a browser's own print dialog can do things this cannot, like
 * choosing a printer.
 */
export function LedgerActions({ ledger }: { ledger: Ledger }) {
    const [failed, setFailed] = useState<string | null>(null);

    function download() {
        setFailed(null);

        try {
            downloadLedgerPdf(ledger);
        } catch (error) {
            // A failed save is silent otherwise: the file simply never appears,
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
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" onClick={() => window.print()} stackOnMobile>
                    <Icon name="fileText" className="size-4" />
                    Print
                </Button>
                <Button onClick={download} stackOnMobile>
                    <Icon name="fileText" className="size-4" />
                    Download PDF
                </Button>
            </div>

            {failed ? (
                <p className="text-xs text-negative">{failed}</p>
            ) : null}
        </div>
    );
}
