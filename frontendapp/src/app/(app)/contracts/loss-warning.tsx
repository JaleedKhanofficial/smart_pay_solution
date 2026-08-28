"use client";

import { Icon } from "@/components/icons";
import type { LossPreview } from "@/types/investor";

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/**
 * BR-20 / FR-CON-16. Who loses what, named before the write-off is committed.
 *
 * Shown in both places that reach BR-20 — the cancel dialog and the Recycle
 * Bin's purge — because both destroy the stream the capital was coming back
 * through, and both are irreversible for the investor.
 *
 * A funder whose stake fully returned is left out: there is nothing to warn
 * about, and listing them at zero would bury the ones who matter.
 */
export function LossWarning({
    lines,
    verb,
}: {
    lines: LossPreview[];
    /** What is about to happen, for the sentence: "cancelling", "purging". */
    verb: string;
}) {
    const losing = lines.filter((line) => Number(line.unrecovered) > 0);

    if (losing.length === 0) return null;

    const borne = losing
        .filter((line) => line.participates)
        .reduce((sum, line) => sum + Number(line.unrecovered), 0);

    const absorbed = losing
        .filter((line) => !line.participates)
        .reduce((sum, line) => sum + Number(line.unrecovered), 0);

    return (
        <div className="rounded-md border border-negative/40 bg-negative/8 p-3">
            <p className="flex items-start gap-2 text-sm font-medium text-negative">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                <span>
                    {losing.length === 1
                        ? "One investor's capital has not come back."
                        : `${losing.length} investors' capital has not come back.`}
                </span>
            </p>

            <p className="mt-1 text-xs text-muted">
                {verb} this contract writes the shortfall off for good (BR-20).
                Profit that has not yet matured is extinguished, not paid.
            </p>

            <ul className="mt-3 flex flex-col gap-2">
                {losing.map((line) => (
                    <li
                        key={line.investor_id}
                        className="rounded border border-border bg-surface px-3 py-2 text-xs"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="font-medium text-foreground">
                                {line.investor_name}
                            </span>
                            <span className="tabular-nums font-medium text-negative">
                                {pkr(line.unrecovered)}
                            </span>
                        </div>
                        <p className="mt-0.5 text-muted">
                            {pkr(line.funded)} put in, {pkr(line.recovered)}{" "}
                            recovered
                            {Number(line.extinguished_profit) > 0
                                ? `, ${pkr(line.extinguished_profit)} of profit given up`
                                : ""}
                            .
                        </p>
                        {line.participates ? null : (
                            <p className="mt-0.5 text-muted">
                                The business absorbs this one — they do not
                                participate in losses, so their balance is left
                                whole.
                            </p>
                        )}
                    </li>
                ))}
            </ul>

            {absorbed > 0 ? (
                <p className="mt-2 text-xs text-muted">
                    {borne > 0
                        ? `${pkr(String(borne))} falls on the investors; the business absorbs ${pkr(String(absorbed))}.`
                        : `The business absorbs all ${pkr(String(absorbed))}.`}
                </p>
            ) : null}
        </div>
    );
}
