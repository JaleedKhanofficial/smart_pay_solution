"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { previewContract, saveContract } from "./actions";
import { SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardFields, CardHeader } from "@/components/ui/card";
import { ComboboxField } from "@/components/ui/combobox";
import { formatDate } from "@/lib/format";
import { EMPTY_FORM_STATE } from "@/types/customer";
import type { Contract, ContractPreview } from "@/types/contract";

type Option = { value: string; label: string };

type Props = {
    contract: Contract | null;
    customers: Option[];
    products: Option[];
    /** FR-CON-07-v2: set once a payment exists, which locks the terms. */
    termsLocked: boolean;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** NFR-02: PKR, en-PK grouping, no decimals. */
function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

function Figure({
    label,
    value,
    strong,
    hint,
}: {
    label: string;
    value: string;
    strong?: boolean;
    hint?: string;
}) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {label}
            </dt>
            <dd
                className={`tabular-nums ${
                    strong
                        ? "text-lg font-semibold text-foreground"
                        : "text-sm text-foreground"
                }`}
            >
                {value}
            </dd>
            {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
        </div>
    );
}

export function ContractForm({
    contract,
    customers,
    products,
    termsLocked,
}: Props) {
    const isEditing = contract !== null;

    const [state, formAction, pending] = useActionState(
        saveContract.bind(null, contract?.id ?? null),
        EMPTY_FORM_STATE
    );

    const initial = (name: string, stored?: string | number | null) =>
        state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));

    // The preview is the server's own arithmetic, so what is shown here is
    // what will be stored — see FR-CON-04-v2.
    const [terms, setTerms] = useState(() => ({
        // One price, not two. The business buys the unit and applies the
        // markup to what it paid, so cost and sale are the same figure and
        // asking twice only invites a typo (SRS §2.7 item 15).
        cost_price: initial("cost_price", contract?.cost_price),
        markup_pct: initial("markup_pct", contract?.markup_pct ?? "35"),
        down_payment: initial("down_payment", contract?.down_payment),
        plan_months: initial("plan_months", contract?.plan_months ?? 12),
        start_date: initial(
            "start_date",
            contract?.start_date ?? new Date().toISOString().slice(0, 10)
        ),
    }));
    const [, startPreview] = useTransition();

    /**
     * The exact terms a result belongs to. Carrying it means a stale result is
     * *recognised* as stale and dimmed rather than cleared — clearing it would
     * mean a setState in the effect body, which the React Compiler rejects, and
     * would blank the panel on every keystroke besides.
     */
    const termsKey = JSON.stringify(terms);

    const [result, setResult] = useState<{
        key: string;
        preview: ContractPreview | null;
        error: string | null;
    } | null>(null);

    const complete =
        Number(terms.cost_price) > 0 &&
        Number(terms.plan_months) > 0 &&
        terms.start_date !== "";

    useEffect(() => {
        if (!complete) return;

        // Debounced: the preview is a round trip, and a keystroke is not worth
        // one. 350ms is below the threshold where typing feels laggy.
        const timer = setTimeout(() => {
            startPreview(async () => {
                const priced = await previewContract({
                    cost_price: Number(terms.cost_price),
                    sale_price: Number(terms.cost_price),
                    markup_pct: Number(terms.markup_pct || 0),
                    down_payment: Number(terms.down_payment || 0),
                    plan_months: Number(terms.plan_months),
                    product_condition: "New",
                    start_date: terms.start_date,
                });

                setResult(
                    priced.ok
                        ? { key: termsKey, preview: priced.preview, error: null }
                        : { key: termsKey, preview: null, error: priced.message }
                );
            });
        }, 350);

        return () => clearTimeout(timer);
    }, [termsKey, complete, terms]);

    // Derived, not stored: an incomplete form has no plan, and a result priced
    // from older terms is shown greyed rather than passed off as current.
    const preview = complete ? (result?.preview ?? null) : null;
    const previewError = complete ? (result?.error ?? null) : null;
    const stale = result !== null && result.key !== termsKey;

    const change = (field: keyof typeof terms) => (
        event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => setTerms((current) => ({ ...current, [field]: event.target.value }));

    return (
        <form
            key={state.attempt}
            action={formAction}
            className="flex flex-col gap-6"
        >
            {termsLocked ? (
                <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/8 px-4 py-3">
                    <Icon
                        name="alert"
                        className="mt-0.5 size-4 shrink-0 text-brand-ink"
                    />
                    <p className="text-sm text-foreground">
                        <span className="font-medium">
                            The financial terms are locked.
                        </span>{" "}
                        <span className="text-muted">
                            Payments have been recorded against this contract,
                            so only the condition and notes can change
                            (FR-CON-07-v2). Void the payments to edit the terms.
                        </span>
                    </p>
                </div>
            ) : null}

            <Card>
                <CardHeader
                    title="Agreement"
                    description="Who is taking what, and on which terms."
                />
                <CardFields>
                    {/* Searchable rather than native selects: these two lists
                        grow without limit, and scrolling a few hundred names
                        to find one is not a picker. */}
                    <ComboboxField
                        label="Customer"
                        name="customer_id"
                        required
                        disabled={termsLocked}
                        options={customers}
                        defaultValue={initial("customer_id", contract?.customer_id)}
                        placeholder="Search by name or CNIC…"
                    />
                    <ComboboxField
                        label="Product"
                        name="product_id"
                        required
                        disabled={termsLocked}
                        options={products}
                        defaultValue={initial("product_id", contract?.product_id)}
                        placeholder="Search products…"
                        hint="Only active products can be put on a new contract."
                    />
                    <SelectField
                        label="Condition"
                        name="product_condition"
                        options={[
                            { value: "New", label: "New" },
                            { value: "Used", label: "Used" },
                        ]}
                        defaultValue={initial(
                            "product_condition",
                            contract?.product_condition ?? "New"
                        )}
                    />
                </CardFields>
            </Card>

            <Card>
                <CardHeader
                    title="Terms"
                    description="Type the raw figures; the server computes and stores the rest."
                />
                <CardFields wide>
                    <TextField
                        label="Purchase price (Rs.)"
                        name="cost_price"
                        type="number"
                        min={0.01}
                        step="0.01"
                        required
                        disabled={termsLocked}
                        value={terms.cost_price}
                        onChange={change("cost_price")}
                        placeholder="45,000"
                        hint="What the unit cost. The markup is applied to this."
                    />
                    <TextField
                        label="Markup %"
                        name="markup_pct"
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        disabled={termsLocked}
                        value={terms.markup_pct}
                        onChange={change("markup_pct")}
                        hint="Applied to the purchase price above."
                    />
                    <TextField
                        label="Down payment (Rs.)"
                        name="down_payment"
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={termsLocked}
                        value={terms.down_payment}
                        onChange={change("down_payment")}
                        placeholder="10,000"
                    />
                    <TextField
                        label="Plan months"
                        name="plan_months"
                        type="number"
                        min={1}
                        required
                        disabled={termsLocked}
                        value={terms.plan_months}
                        onChange={change("plan_months")}
                    />
                    <TextField
                        label="Start date"
                        name="start_date"
                        type="date"
                        required
                        disabled={termsLocked}
                        value={terms.start_date}
                        onChange={change("start_date")}
                        hint="Installments fall due on the 1st of each following month."
                    />
                    <div className="sm:col-span-2">
                        <TextAreaField
                            label="Notes"
                            name="notes"
                            rows={2}
                            maxLength={2000}
                            defaultValue={initial("notes", contract?.notes)}
                        />
                    </div>
                </CardFields>
            </Card>

            <Card>
                <CardHeader
                    title="Plan"
                    description="Priced by the server, so these are the figures that will be stored."
                    actions={
                        preview ? (
                            <Badge tone={stale ? "neutral" : "accent"}>
                                {stale
                                    ? "repricing…"
                                    : `${preview.plan_months} installments`}
                            </Badge>
                        ) : null
                    }
                />

                {previewError ? (
                    <p className="px-4 py-4 text-sm text-negative sm:px-5">
                        {previewError}
                    </p>
                ) : !preview ? (
                    <p className="px-4 py-6 text-sm text-muted sm:px-5">
                        Fill in the sale price, cost, term and start date to see
                        the plan.
                    </p>
                ) : (
                    /* Shown greyed while newer terms are being priced, rather
                       than blanked — blanking on every keystroke makes the
                       panel flash and tells the operator nothing. */
                    <div className={stale ? "opacity-50 transition-opacity" : ""}>
                        <dl className="grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-4">
                            <Figure
                                label="Profit"
                                value={pkr(preview.markup_amount)}
                                hint={`${preview.markup_pct} % of purchase`}
                            />
                            <Figure
                                label="Net amount"
                                value={pkr(preview.net_amount)}
                            />
                            <Figure
                                label="Financed"
                                value={pkr(preview.financed_amount)}
                                hint="Net less down payment"
                            />
                            <Figure
                                label="Monthly"
                                value={pkr(preview.monthly_installment)}
                                strong
                                hint="Last installment absorbs the remainder"
                            />
                            <Figure
                                label="Ends"
                                value={formatDate(preview.end_date)}
                            />
                        </dl>

                        <div className="max-h-64 overflow-y-auto border-t border-border">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead className="sticky top-0 border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                                    <tr>
                                        <th className="px-4 py-2 font-medium sm:px-5">
                                            #
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Due
                                        </th>
                                        <th className="px-4 py-2 text-right font-medium sm:px-5">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {preview.schedule.map((row) => (
                                        <tr key={row.seq}>
                                            <td className="px-4 py-2 tabular-nums text-muted sm:px-5">
                                                {row.seq}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                                                {formatDate(row.due_date)}
                                            </td>
                                            <td className="px-4 py-2 text-right tabular-nums sm:px-5">
                                                {pkr(row.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Card>

            {state.message && !state.ok ? (
                <div className="rounded-md border border-negative/40 bg-negative/8 px-4 py-3 text-sm text-negative">
                    {state.errors.length > 1 ? (
                        <>
                            <p className="mb-1 font-medium">
                                Please correct the following:
                            </p>
                            <ul className="list-inside list-disc space-y-1">
                                {state.errors.map((error) => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        state.message
                    )}
                </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <Button type="submit" disabled={pending} stackOnMobile>
                    {pending
                        ? "Saving…"
                        : isEditing
                          ? "Save changes"
                          : "Create contract"}
                </Button>
                <ButtonLink href="/contracts" variant="secondary" stackOnMobile>
                    Cancel
                </ButtonLink>
            </div>
        </form>
    );
}
