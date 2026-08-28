"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { downloadSummaryPdf, summaryAsText } from "@/lib/summary-export";
import type { Summary } from "@/types/report";

/**
 * FR-SUM-08. Three ways out of the workbook.
 *
 * All of them act on the **page you are looking at**, filters and sort
 * included — exporting the whole portfolio when you have deliberately narrowed
 * it to one client would be the wrong answer. The counters printed at the top
 * stay portfolio-wide, and the sheet says how many rows of how many it holds.
 */
export function SummaryActions({ summary }: { summary: Summary }) {
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    async function copy() {
        setFailed(null);

        try {
            await navigator.clipboard.writeText(
                summaryAsText(summary.rows.data)
            );

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // The clipboard needs a secure context and permission; over plain
            // HTTP on a LAN it simply refuses, and silence would be baffling.
            setFailed(
                "The browser would not give access to the clipboard. Use Download PDF instead."
            );
        }
    }

    function download() {
        setFailed(null);

        try {
            downloadSummaryPdf(summary, summary.rows.data);
        } catch (error) {
            setFailed(
                error instanceof Error
                    ? error.message
                    : "Could not build the PDF."
            );
        }
    }

    return (
        <div className="flex flex-col items-end gap-2 print-hide">
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" onClick={copy} stackOnMobile>
                    <Icon name={copied ? "check" : "fileText"} className="size-4" />
                    {copied ? "Copied" : "Copy table"}
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => window.print()}
                    stackOnMobile
                >
                    <Icon name="fileText" className="size-4" />
                    Print
                </Button>
                <Button onClick={download} stackOnMobile>
                    <Icon name="barChart" className="size-4" />
                    Download PDF
                </Button>
            </div>

            {failed ? (
                <p className="max-w-xs text-right text-xs text-negative">
                    {failed}
                </p>
            ) : null}
        </div>
    );
}
