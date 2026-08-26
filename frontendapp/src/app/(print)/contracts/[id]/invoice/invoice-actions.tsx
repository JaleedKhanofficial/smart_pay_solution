"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";

/**
 * FR-INV-06. The control bar above the sheet. It is `print:hidden`, so it is on
 * screen and absent from the paper.
 *
 * `window.print()` rather than a server-rendered PDF: printing ships in Phase 1
 * and the PDF endpoint is Phase 2, and the browser's own dialog already offers
 * "Save as PDF" on every platform the business uses.
 */
export function InvoiceActions({ contractId }: { contractId: number }) {
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

                <button
                    type="button"
                    onClick={() => window.print()}
                    className={`${button} bg-[#13365E] text-white hover:bg-[#1A4574]`}
                >
                    <Icon name="fileText" className="size-4" />
                    Print / Save as PDF
                </button>
            </div>

            <p className="mx-auto max-w-[210mm] px-4 pb-3 text-xs text-slate-500">
                Prints on A4. In the browser dialog, leave{" "}
                <span className="font-medium text-slate-700">
                    Background graphics
                </span>{" "}
                on so the headings keep their colour, and set margins to{" "}
                <span className="font-medium text-slate-700">Default</span>.
            </p>
        </div>
    );
}
