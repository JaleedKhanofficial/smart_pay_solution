"use client";

import { useState } from "react";
import {
    SelectField,
    TextField,
    fieldClass,
    labelClass,
} from "@/components/form-fields";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { FundableInvestor } from "@/types/investor";

type Line = {
    /** Stable across re-renders so React does not remount a row on removal. */
    key: number;
    investor_id: string;
    amount: string;
    /** FR-CON-12. Blank means "use the investor's standing share". */
    profit_share_pct: string;
    share_override_reason: string;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(paisa: number): string {
    return `Rs. ${money.format(Math.round(paisa) / 100)}`;
}

/** Money is compared in whole paisa; 0.1 + 0.2 has no place in a balance. */
function toPaisa(value: string | number): number {
    const amount = Number(value);

    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/**
 * FR-CON-11. Which investors are putting money into this deal, and how much.
 *
 * **Create only.** BR-19 fixes the funding at activation and FR-CON-15 makes it
 * immutable, so there is no edit form — a contract's funders are decided once,
 * because the shares they imply are what every later recovery is split by.
 *
 * **Admin only.** The whole of Module 13 is (NFR-15); an operator writing a
 * contract never sees this card, and the API refuses the field regardless.
 *
 * The arithmetic here is a *preview*, in the same spirit as the plan panel
 * above it: the server recomputes every share from the cost price it priced
 * itself (BR-15), so what is shown here cannot decide what is stored.
 */
export function FundingPanel({
    investors,
    costPrice,
}: {
    investors: FundableInvestor[];
    /** The live purchase price from the terms above, in rupees. */
    costPrice: string;
}) {
    const [lines, setLines] = useState<Line[]>([]);
    const [nextKey, setNextKey] = useState(1);

    const cost = toPaisa(costPrice);
    const byId = new Map(
        investors.map((investor) => [String(investor.id), investor])
    );

    const funded = lines.reduce((sum, line) => sum + toPaisa(line.amount), 0);
    const house = cost - funded;

    const add = () => {
        setLines((current) => [
            ...current,
            {
                key: nextKey,
                investor_id: "",
                amount: "",
                profit_share_pct: "",
                share_override_reason: "",
            },
        ]);
        setNextKey((key) => key + 1);
    };

    const update = (key: number, field: keyof Line, value: string) =>
        setLines((current) =>
            current.map((line) =>
                line.key === key ? { ...line, [field]: value } : line
            )
        );

    const remove = (key: number) =>
        setLines((current) => current.filter((line) => line.key !== key));

    // Which investors a given row may still offer: an investor cannot fund the
    // same contract twice (FR-CON-13), so every other row's choice is withheld.
    // The row's own choice stays, or the select would clear itself.
    const optionsFor = (line: Line) => {
        const taken = new Set(
            lines
                .filter((other) => other.key !== line.key)
                .map((other) => other.investor_id)
        );

        return [
            { value: "", label: "Select an investor…" },
            ...investors
                .filter((investor) => !taken.has(String(investor.id)))
                .map((investor) => ({
                    value: String(investor.id),
                    label: `${investor.full_name} — ${pkr(toPaisa(investor.available))} available`,
                })),
        ];
    };

    return (
        <Card>
            <CardHeader
                title="Funding"
                description="Whose money is buying this unit. Leave it empty and the house funds the whole deal."
                actions={
                    lines.length > 0 ? (
                        <Badge tone={house < 0 ? "negative" : "accent"}>
                            {lines.length} investor
                            {lines.length === 1 ? "" : "s"}
                        </Badge>
                    ) : null
                }
            />

            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
                {investors.length === 0 ? (
                    <p className="text-sm text-muted">
                        No investor has capital available to deploy. Record a
                        deposit on the{" "}
                        <span className="font-medium text-foreground">
                            Investors
                        </span>{" "}
                        page first — until then this contract is house-funded.
                    </p>
                ) : (
                    <>
                        {lines.map((line) => {
                            const investor = byId.get(line.investor_id);
                            const amount = toPaisa(line.amount);
                            const available = investor
                                ? toPaisa(investor.available)
                                : 0;

                            // BR-15. The share is the funder's slice of cost,
                            // and it is what every later recovery is split by.
                            const share =
                                cost > 0 && amount > 0
                                    ? ((amount / cost) * 100).toFixed(2)
                                    : null;

                            const over =
                                investor !== undefined && amount > available;

                            return (
                                <div
                                    key={line.key}
                                    className="rounded-lg border border-border bg-surface-muted/40 p-3 sm:p-4"
                                >
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_auto]">
                                        <SelectField
                                            label="Investor"
                                            name={`funding_investor_${line.key}`}
                                            options={optionsFor(line)}
                                            value={line.investor_id}
                                            onChange={(event) =>
                                                update(
                                                    line.key,
                                                    "investor_id",
                                                    event.target.value
                                                )
                                            }
                                        />
                                        <TextField
                                            label="Amount (Rs.)"
                                            name={`funding_amount_${line.key}`}
                                            type="number"
                                            min={0.01}
                                            step="0.01"
                                            value={line.amount}
                                            onChange={(event) =>
                                                update(
                                                    line.key,
                                                    "amount",
                                                    event.target.value
                                                )
                                            }
                                            hint={
                                                share
                                                    ? `${share}% of the purchase price`
                                                    : investor
                                                      ? `${pkr(available)} available`
                                                      : undefined
                                            }
                                        />
                                        <div className="flex items-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => remove(line.key)}
                                            >
                                                <Icon
                                                    name="trash"
                                                    className="size-4"
                                                />
                                                Remove
                                            </Button>
                                        </div>
                                    </div>

                                    {over ? (
                                        <p className="mt-2 text-xs text-negative">
                                            {investor.full_name} has only{" "}
                                            {pkr(available)} available —{" "}
                                            {pkr(amount - available)} short.
                                        </p>
                                    ) : null}

                                    {/* FR-CON-12. The standing share is the
                                        norm; a deal-specific one is an
                                        exception, and has to be justified. */}
                                    <details className="mt-3">
                                        <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                                            {line.profit_share_pct
                                                ? `Profit share overridden to ${line.profit_share_pct}%`
                                                : `Profit share: ${investor?.profit_share_pct ?? "—"}% (their standing rate)`}
                                        </summary>

                                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
                                            <div>
                                                <label
                                                    className={labelClass}
                                                    htmlFor={`share-${line.key}`}
                                                >
                                                    Profit share %
                                                </label>
                                                <input
                                                    id={`share-${line.key}`}
                                                    className={fieldClass}
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.01"
                                                    placeholder={
                                                        investor?.profit_share_pct ??
                                                        ""
                                                    }
                                                    value={line.profit_share_pct}
                                                    onChange={(event) =>
                                                        update(
                                                            line.key,
                                                            "profit_share_pct",
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label
                                                    className={labelClass}
                                                    htmlFor={`reason-${line.key}`}
                                                >
                                                    Why this deal differs
                                                </label>
                                                <input
                                                    id={`reason-${line.key}`}
                                                    className={fieldClass}
                                                    maxLength={500}
                                                    placeholder="Required when the share is overridden"
                                                    value={
                                                        line.share_override_reason
                                                    }
                                                    onChange={(event) =>
                                                        update(
                                                            line.key,
                                                            "share_override_reason",
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </details>

                                    {/* Index-aligned across the four lists, so
                                        an omitted optional would misalign every
                                        row after it — each posts all four. */}
                                    <input
                                        type="hidden"
                                        name="funding_investor_id"
                                        value={line.investor_id}
                                    />
                                    <input
                                        type="hidden"
                                        name="funding_amount"
                                        value={line.amount}
                                    />
                                    <input
                                        type="hidden"
                                        name="funding_profit_share_pct"
                                        value={line.profit_share_pct}
                                    />
                                    <input
                                        type="hidden"
                                        name="funding_reason"
                                        value={line.share_override_reason}
                                    />
                                </div>
                            );
                        })}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={add}
                                disabled={lines.length >= investors.length}
                            >
                                <Icon name="plus" className="size-4" />
                                Add an investor
                            </Button>

                            {lines.length > 0 && cost > 0 ? (
                                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                                    <div className="flex gap-2">
                                        <dt className="text-muted">Funded</dt>
                                        <dd className="font-medium tabular-nums text-foreground">
                                            {pkr(funded)}
                                        </dd>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* BR-14. Whatever is not funded is the
                                            house's own capital, by definition. */}
                                        <dt className="text-muted">House</dt>
                                        <dd
                                            className={`font-medium tabular-nums ${
                                                house < 0
                                                    ? "text-negative"
                                                    : "text-foreground"
                                            }`}
                                        >
                                            {pkr(house)}
                                        </dd>
                                    </div>
                                </dl>
                            ) : null}
                        </div>

                        {house < 0 ? (
                            <p className="text-sm text-negative">
                                {pkr(funded)} has been allocated against a
                                purchase price of {pkr(cost)}. The house cannot
                                be funded below zero — reduce the allocations by{" "}
                                {pkr(-house)}.
                            </p>
                        ) : null}
                    </>
                )}
            </div>
        </Card>
    );
}
