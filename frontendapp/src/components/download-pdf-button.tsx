"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Button } from "./ui/button";

/**
 * The one Download PDF control in the application.
 *
 * It exists because there were five, and they had drifted: three different
 * icons (`fileText`, `barChart`, `download`), two button variants, and one
 * hand-written colour. A reader learns what a control looks like once, and
 * five spellings of the same action teach them nothing.
 *
 * **Filled navy, always** — the colour these buttons already had before they
 * were unified. Downloading is what people come to a report to do, and a quiet
 * outline undersold it.
 *
 * It owns the failure path too. Every call site had the same try/catch around
 * the same silent failure: a save that throws produces no file and no message,
 * and the operator is left wondering whether they missed the download.
 */
export function DownloadPdfButton({
    build,
    label = "Download PDF",
    disabled,
    className = "",
}: {
    /** Builds and saves the file. Throwing is how it reports failure. */
    build: () => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}) {
    const [failed, setFailed] = useState<string | null>(null);

    function download() {
        setFailed(null);

        try {
            build();
        } catch (error) {
            setFailed(
                error instanceof Error
                    ? error.message
                    : "Could not build the PDF."
            );
        }
    }

    return (
        <div className={`flex flex-col items-end gap-1 ${className}`}>
            <Button
                onClick={download}
                disabled={disabled}
                stackOnMobile
            >
                <Icon name="download" className="size-4" />
                {label}
            </Button>

            {failed ? (
                <p className="max-w-xs text-right text-xs text-negative">
                    {failed}
                </p>
            ) : null}
        </div>
    );
}
