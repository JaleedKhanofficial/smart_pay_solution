"use client";

import { useState, useTransition } from "react";
import { setPeriodMembers } from "./actions";
import { Button } from "@/components/ui/button";
import type { ExpensePeriod } from "@/types/expense";

type Props = {
    period: ExpensePeriod;
    investors: { id: number; label: string }[];
    onSaved: (message: string) => void;
    onCancel: () => void;
};

type Draft = {
    investor_id: number;
    label: string;
    member: boolean;
    waived: boolean;
    waive_reason: string;
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(paisa: number): string {
    return `Rs. ${money.format(Math.round(paisa) / 100)}`;
}

/**
 * BR-28/BR-29. Who carries this pot.
 *
 * Two separate switches, because they answer different questions. **Member**
 * decides whether the split counts this person at all. **Waived** says they
 * are counted — the pot is still divided by the whole roster — but their share
 * is not billed to them.
 *
 * That distinction is the whole of BR-29. Dropping someone from the roster
 * reprices everyone left: five people splitting 24,550 pay 4,910 each instead
 * of the 4,092 they agreed. Waiving them leaves the other five paying exactly
 * what they always paid, and the business absorbs the sixth share. The
 * preview below shows both figures so the choice is made with its consequence
 * in view rather than after the fact.
 */
export function MembersForm({ period, investors, onSaved, onCancel }: Props) {
    const [pending, startTransition] = useTransition();
    const [failure, setFailure] = useState<string | null>(null);

    const [drafts, setDrafts] = useState<Draft[]>(() =>
        investors.map((investor) => {
            const existing = period.members.find(
                (member) => member.investor_id === investor.id
            );

            return {
                investor_id: investor.id,
                label: investor.label,
                member: existing !== undefined,
                waived: existing?.waived ?? false,
                waive_reason: existing?.waive_reason ?? "",
            };
        })
    );

    function update(investorId: number, patch: Partial<Draft>) {
        setDrafts((current) =>
            current.map((draft) =>
                draft.investor_id === investorId
                    ? { ...draft, ...patch }
                    : draft
            )
        );
    }

    const roster = drafts.filter((draft) => draft.member);
    const carrying = roster.filter((draft) => !draft.waived);

    /**
     * The same arithmetic the API does, in paisa.
     *
     * Divided by the **whole** roster, waived members included, and the
     * residual settled on the first share so the parts sum to the pot exactly
     * (BR-26). What the waived members would have carried is absorbed, not
     * spread over the rest.
     */
    const total = Math.round(Number(period.total) * 100);
    const perMember = roster.length > 0 ? Math.floor(total / roster.length) : 0;
    const residual = total - perMember * roster.length;

    const billed = roster.reduce(
        (sum, draft, index) =>
            draft.waived ? sum : sum + perMember + (index === 0 ? residual : 0),
        0
    );

    const waivedCount = roster.length - carrying.length;
    const absorbed = total - billed;

    // A waiver with no reason is an unexplained bill somebody else carries,
    // and the database refuses it outright — so the button does too.
    const unexplained = roster.filter(
        (draft) => draft.waived && draft.waive_reason.trim() === ""
    );

    function save() {
        setFailure(null);

        startTransition(async () => {
            const result = await setPeriodMembers(
                period.id,
                roster.map((draft) => ({
                    investor_id: draft.investor_id,
                    waived: draft.waived,
                    ...(draft.waived
                        ? { waive_reason: draft.waive_reason.trim() }
                        : {}),
                }))
            );

            if (result.ok) {
                onSaved(result.message ?? "Members saved.");
                return;
            }

            setFailure(result.message ?? "Those members could not be saved.");
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
                <p className="text-foreground">
                    {roster.length === 0 ? (
                        "Nobody carries this period yet."
                    ) : (
                        <>
                            {pkr(total)} divided between {roster.length}
                            {" — "}
                            <span className="font-semibold tabular-nums">
                                {pkr(perMember)}
                            </span>{" "}
                            each.
                        </>
                    )}
                </p>
                {waivedCount > 0 ? (
                    <p className="mt-1 text-xs text-muted">
                        {pkr(absorbed)} is carried by the business —{" "}
                        {waivedCount} waived share
                        {waivedCount === 1 ? "" : "s"}. The others carry exactly
                        what they would have carried anyway.
                    </p>
                ) : null}
            </div>

            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {drafts.length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-muted">
                        No investors on the books yet.
                    </li>
                ) : (
                    drafts.map((draft) => (
                        <li
                            key={draft.investor_id}
                            className="flex flex-col gap-2 px-4 py-3"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <label className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={draft.member}
                                        onChange={(event) =>
                                            update(draft.investor_id, {
                                                member: event.target.checked,
                                                waived: event.target.checked
                                                    ? draft.waived
                                                    : false,
                                            })
                                        }
                                        className="size-4 rounded border-border accent-brand"
                                    />
                                    <span className="text-sm text-foreground">
                                        {draft.label}
                                    </span>
                                </label>

                                {draft.member ? (
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm tabular-nums text-muted">
                                            {draft.waived
                                                ? "waived"
                                                : pkr(perMember)}
                                        </span>
                                        <label className="flex items-center gap-2 text-xs text-muted">
                                            <input
                                                type="checkbox"
                                                checked={draft.waived}
                                                onChange={(event) =>
                                                    update(draft.investor_id, {
                                                        waived: event.target
                                                            .checked,
                                                    })
                                                }
                                                className="size-4 rounded border-border accent-brand"
                                            />
                                            Waive
                                        </label>
                                    </div>
                                ) : null}
                            </div>

                            {draft.member && draft.waived ? (
                                <input
                                    value={draft.waive_reason}
                                    onChange={(event) =>
                                        update(draft.investor_id, {
                                            waive_reason: event.target.value,
                                        })
                                    }
                                    maxLength={500}
                                    placeholder="Why is this share waived?"
                                    aria-label={`Reason ${draft.label}'s share is waived`}
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
                                />
                            ) : null}
                        </li>
                    ))
                )}
            </ul>

            {unexplained.length > 0 ? (
                <p className="rounded-md border border-brand/40 bg-brand/8 px-4 py-3 text-sm text-foreground">
                    A waiver needs a reason:{" "}
                    {unexplained.map((draft) => draft.label).join(", ")}.
                </p>
            ) : null}

            {failure ? (
                <div className="rounded-md border border-negative/40 bg-negative/8 px-4 py-3 text-sm text-negative">
                    {failure}
                </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onCancel} stackOnMobile>
                    Cancel
                </Button>
                <Button
                    onClick={save}
                    disabled={pending || unexplained.length > 0}
                    stackOnMobile
                >
                    {pending ? "Saving…" : "Save members"}
                </Button>
            </div>
        </div>
    );
}
