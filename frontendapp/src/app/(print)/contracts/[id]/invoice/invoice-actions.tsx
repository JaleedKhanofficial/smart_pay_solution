"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import type { Invoice } from "@/types/invoice";

/**
 * FR-INV-06. The control bar above the sheet. It is `print:hidden`, so it is on
 * screen and absent from the paper.
 *
 * Two ways out, and they are not the same thing.
 *
 * **Download** builds the agreement from its data with jsPDF, the same way the
 * recovery ledger is built — crisp text, a small file, named for the customer,
 * and identical on every machine whatever appearance the viewer has chosen.
 *
 * **Print** hands the page to the browser, which prints what is on screen and
 * also offers Save as PDF. Kept because it is the honest "what I see" copy,
 * and because the browser's own dialog can choose a printer.
 */
export function InvoiceActions({ invoice }: { invoice: Invoice }) {
    const contractId = invoice.contract.id;
    const [failed, setFailed] = useState<string | null>(null);

    function download() {
        setFailed(null);

        try {
            downloadInvoicePdf(invoice);
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

    const button =
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors";

    return (
        <div className="print:hidden sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                    <Link
                        href="/contracts"
                        className={`${button} border border-slate-300 text-slate-700 hover:bg-slate-50`}
                    >
                        <Icon name="chevronLeft" className="size-4" />
                        Back to contracts
                    </Link>
                    <Link
                        href={`/contracts/${contractId}/edit`}
                        className={`${button} border border-slate-300 text-slate-700 hover:bg-slate-50`}
                    >
                        <Icon name="pencil" className="size-4" />
                        Edit contract
                    </Link>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className={`${button} border border-slate-300 text-slate-700 hover:bg-slate-50`}
                    >
                        <Icon name="fileText" className="size-4" />
                        Print
                    </button>
                    <button
                        type="button"
                        onClick={download}
                        className={`${button} bg-[#13365E] text-white hover:bg-[#1A4574]`}
                    >
                        <Icon name="fileText" className="size-4" />
                        Download PDF
                    </button>
                </div>
            </div>

            {failed ? (
                <p className="mx-auto max-w-[210mm] px-4 pb-2 text-xs text-red-600">
                    {failed}
                </p>
            ) : null}

            <p className="mx-auto max-w-[210mm] px-4 pb-3 text-xs text-slate-500">
                <span className="font-medium text-slate-700">Download PDF</span>{" "}
                builds the file from the agreement data and needs no dialog.
                Print goes through the browser instead: In the browser dialog, leave{" "}
                <span className="font-medium text-slate-700">
                    Background graphics
                </span>{" "}
                on so the headings keep their colour, and set margins to{" "}
                <span className="font-medium text-slate-700">Default</span>.
            </p>
        </div>
    );
}
