"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/download-pdf-button";
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
    return (
        <div className="flex flex-col items-end gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    variant="secondary"
                    onClick={() => window.print()}
                    stackOnMobile
                >
                    <Icon name="fileText" className="size-4" />
                    Print
                </Button>
                <DownloadPdfButton
                    build={() => downloadLedgerPdf(ledger)}
                />
            </div>
        </div>
    );
}
