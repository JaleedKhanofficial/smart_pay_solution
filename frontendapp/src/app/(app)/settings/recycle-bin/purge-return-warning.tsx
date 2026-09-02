"use client";

import { Icon } from "@/components/icons";
import type { PurgeReturnPreview } from "@/types/investor";

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/**
 * FR-BIN-03. Who gets what back when a funded contract is purged from the bin.
 *
 * Purging destroys the deal — it does not write the shortfall off as a Loss.
 * Deployed capital returns to each investor's idle balance when the funding
 * rows are removed.
 */
export function PurgeReturnWarning({ lines }: { lines: PurgeReturnPreview[] }) {
    if (lines.length === 0) return null;

    return (
        <div className="rounded-md border border-chrome-600/30 bg-chrome-600/8 p-3">
            <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                <Icon name="check" className="mt-0.5 size-4 shrink-0" />
                <span>Investor capital will return to idle.</span>
            </p>

            <p className="mt-1 text-xs text-muted">
                Purging removes this deal. Any stake that has not been recovered
                goes back to each investor&apos;s available balance — it is not
                written off as a loss.
            </p>

            <ul className="mt-3 flex flex-col gap-2">
                {lines.map((line) => (
                    <li
                        key={line.investor_id}
                        className="rounded border border-border bg-surface px-3 py-2 text-xs"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="font-medium text-foreground">
                                {line.investor_name}
                            </span>
                            {Number(line.returning) > 0 ? (
                                <span className="tabular-nums font-medium text-positive">
                                    + {pkr(line.returning)} back
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-muted">
                            {pkr(line.funded)} put in, {pkr(line.recovered)}{" "}
                            recovered
                            {Number(line.matured_profit) > 0
                                ? `, ${pkr(line.matured_profit)} of profit kept`
                                : ""}
                            .
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
