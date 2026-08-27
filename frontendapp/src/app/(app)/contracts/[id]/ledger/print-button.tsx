"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * FR-REC-07. Print via the browser, which also gives "Save as PDF" on every
 * platform. The app chrome is dropped by the print stylesheet, so the ledger
 * can live inside the shell and still print as a document (NFR-03).
 */
export function PrintLedgerButton() {
    return (
        <Button variant="secondary" onClick={() => window.print()} stackOnMobile>
            <Icon name="fileText" className="size-4" />
            Print
        </Button>
    );
}
