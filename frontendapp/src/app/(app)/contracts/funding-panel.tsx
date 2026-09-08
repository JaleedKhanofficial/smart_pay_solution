"use client";

import Link from "next/link";
import { useImperativeHandle, useState, type RefObject } from "react";
import {
    SelectField,
    TextField,
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

/** What the form can ask the panel to do from a submit handler. */
export type FundingPanelHandle = {
    /** Opens one empty row, unless rows are already open. */
    openRow: () => void;
};

/**
 * FR-CON-11. Which investors are putting money into this deal, and how much.
 *
 * **Create only.** BR-19 fixes the funding at activation and FR-CON-15 makes it
 * immutable, so there is no edit form — a contract's funders are decided once,
 * because the shares they imply are what every later recovery is split by.
 *
 * **Required, and to the full purchase price.** The investors buy the unit
 * outright — the business puts none of its own capital in — so the amounts
 * here have to come to the cost price exactly. One investor who cannot cover
 * it is a deal waiting for a second, not a deal the house tops up. The API
 * applies the same rule; the form is the courtesy, not the rule.
 *
 * The arithmetic here is a *preview*, in the same spirit as the plan panel
 * above it: the server recomputes every share from the cost price it priced
 * itself (BR-15), so what is shown here cannot decide what is stored.
 */
export function FundingPanel({
    investors,
    costPrice,
    error,
    ref,
}: {
    investors: FundableInvestor[];
    /** The live purchase price from the terms above, in rupees. */
    costPrice: string;
    /** Set by the form when a save was refused for want of an investor. */
    error?: string | null;
    ref?: RefObject<FundingPanelHandle | null>;
}) {
    const [lines, setLines] = useState<Line[]>([]);
    const [nextKey, setNextKey] = useState(1);

    /**
     * Driven from the form's submit handler rather than by an effect watching a
     * prop: opening a row is something that *happens* when someone presses
     * Create, not a state the panel has to stay in sync with. Reacting to a
     * flag would mean a setState in an effect body, which the React Compiler
     * rejects, and would need a second round trip to clear the flag again.
     */
    useImperativeHandle(
        ref,
        () => ({
            openRow() {
                setLines((current) =>
                    current.length > 0
                        ? current
                        : [{ key: 0, investor_id: "", amount: "" }],
                );
            },
        }),
        [],
    );

    const cost = toPaisa(costPrice);
    const byId = new Map(
        investors.map((investor) => [String(investor.id), investor])
    );

    const funded = lines.reduce((sum, line) => sum + toPaisa(line.amount), 0);
    /**
     * What still has to be found before the deal can be written. The business
     * puts none of its own money in, so this has to reach zero exactly — a
     * shortfall is a contract waiting for another investor, not a contract the
     * house tops up.
     */
    const remaining = cost - funded;

    const add = () => {
        setLines((current) => [
            ...current,
            {
                key: nextKey,
                investor_id: "",
                amount: "",
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
                description="Investors cover the whole purchase price. Add as many as it takes for the amounts to come to the cost exactly."
                actions={
                    lines.length > 0 ? (
                        <Badge tone={remaining === 0 ? "positive" : "negative"}>
                            {lines.length} investor
                            {lines.length === 1 ? "" : "s"}
                        </Badge>
                    ) : null
                }
            />

            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
                {error ? (
                    <p className="rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative">
                        {error}
                    </p>
                ) : null}

                {investors.length === 0 ? (
                    // No capital, no contract — so this says what to do about
                    // it rather than leaving an empty dropdown to be puzzled
                    // over. The Create button is disabled to match.
                    <p className="text-sm text-muted">
                        <span className="font-medium text-foreground">
                            No investor has capital available to deploy.
                        </span>{" "}
                        A contract cannot be written until one does. Record a
                        deposit on the{" "}
                        <Link
                            href="/investors"
                            className="font-medium text-foreground underline"
                        >
                            Investors
                        </Link>{" "}
                        page, then come back to this form.
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

                                    {/* Index-aligned across the two lists, so an
                                        omitted row would misalign every row
                                        after it — each posts both fields. */}
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
                                        <dt className="text-muted">
                                            {remaining < 0
                                                ? "Over by"
                                                : "Still to fund"}
                                        </dt>
                                        <dd
                                            className={`font-medium tabular-nums ${
                                                remaining === 0
                                                    ? "text-positive"
                                                    : "text-negative"
                                            }`}
                                        >
                                            {pkr(Math.abs(remaining))}
                                        </dd>
                                    </div>
                                </dl>
                            ) : null}
                        </div>

                        {cost > 0 && lines.length > 0 && remaining !== 0 ? (
                            <p className="text-sm text-negative">
                                {remaining > 0 ? (
                                    <>
                                        {pkr(funded)} of the {pkr(cost)}{" "}
                                        purchase price is covered. Add another
                                        investor for the remaining{" "}
                                        {pkr(remaining)} — the business does not
                                        fund deals from its own capital.
                                    </>
                                ) : (
                                    <>
                                        {pkr(funded)} has been allocated against
                                        a purchase price of {pkr(cost)}. Reduce
                                        the allocations by {pkr(-remaining)}.
                                    </>
                                )}
                            </p>
                        ) : null}
                    </>
                )}
            </div>
        </Card>
    );
}
