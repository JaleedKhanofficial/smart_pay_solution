"use client";

import { useState, useTransition } from "react";
import { deletePeriod } from "../actions";
import { MembersForm } from "../members-form";
import { PeriodForm } from "../period-form";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import type { ExpensePeriod } from "@/types/expense";

type Props = {
    periods: ExpensePeriod[];
    investors: { id: number; label: string }[];
};

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/**
 * BR-28/BR-29. Who shares the common expenses.
 *
 * Only needed when the investors change. Close the current group, start a new
 * one, and from then on new common expenses are divided between the new
 * group — what was already spent stays divided between the old one.
 */
export default function PeriodsManager({ periods, investors }: Props) {
    const { confirm, alert } = useAlert();
    const [, startTransition] = useTransition();
    const [editing, setEditing] = useState<ExpensePeriod | "new" | null>(null);
    const [members, setMembers] = useState<ExpensePeriod | null>(null);

    function saved(message: string) {
        setEditing(null);
        setMembers(null);
        void alert({ title: message, tone: "success" });
    }

    async function remove(period: ExpensePeriod) {
        const confirmed = await confirm({
            title: `Delete ${period.label}?`,
            text:
                period.expenses > 0
                    ? "It still has expenses in it, so it cannot be deleted."
                    : "It has no expenses in it.",
            tone: "warning",
            confirmLabel: "Delete",
            destructive: true,
        });

        if (!confirmed) return;

        startTransition(async () => {
            const result = await deletePeriod(period.id);

            void alert(
                result.ok
                    ? { title: result.message ?? "Deleted", tone: "success" }
                    : {
                          title: "Could not delete",
                          text: result.message ?? undefined,
                          tone: "error",
                      }
            );
        });
    }

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Expenses"
                title="Who shares the common expenses"
                description="Each group below lists the investors its common expenses are divided between. When investors change, close the current group and start a new one."
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <ButtonLink
                            href="/expenses"
                            variant="secondary"
                            stackOnMobile
                        >
                            <Icon name="chevronLeft" className="size-4" />
                            Back to expenses
                        </ButtonLink>
                        <Button onClick={() => setEditing("new")} stackOnMobile>
                            <Icon name="plus" className="size-4" />
                            New group
                        </Button>
                    </div>
                }
            />

            {periods.length === 0 ? (
                <Card className="px-4 py-12 text-center text-sm text-muted">
                    No group yet. One is made automatically, with every active
                    investor in it, when you add the first common expense.
                </Card>
            ) : (
                <div className="flex flex-col gap-4">
                    {periods.map((period) => (
                        <Card key={period.id} className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="flex items-center gap-2">
                                        <span className="font-semibold text-foreground">
                                            {period.label}
                                        </span>
                                        <Badge
                                            tone={
                                                period.closed
                                                    ? "neutral"
                                                    : "positive"
                                            }
                                        >
                                            {period.closed ? "closed" : "open"}
                                        </Badge>
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted">
                                        {formatDate(period.starts_on)}
                                        {period.ends_on
                                            ? ` to ${formatDate(period.ends_on)}`
                                            : " onwards"}{" "}
                                        · {period.expenses} expense
                                        {period.expenses === 1 ? "" : "s"}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p className="font-semibold tabular-nums text-foreground">
                                        {pkr(period.total)}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {pkr(period.per_member)} per investor
                                    </p>
                                </div>
                            </div>

                            <p className="mt-3 flex flex-wrap gap-2 text-xs">
                                {period.members.length === 0 ? (
                                    <span className="text-negative">
                                        No investors chosen yet.
                                    </span>
                                ) : (
                                    period.members.map((member) => (
                                        <span
                                            key={member.investor_id}
                                            title={
                                                member.waive_reason ?? undefined
                                            }
                                            className={`rounded-full border border-border px-2.5 py-1 ${
                                                member.waived
                                                    ? "text-muted line-through"
                                                    : "text-foreground"
                                            }`}
                                        >
                                            {member.investor_name}
                                        </span>
                                    ))
                                )}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setMembers(period)}
                                >
                                    <Icon name="users" className="size-4" />
                                    Choose investors
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setEditing(period)}
                                >
                                    <Icon name="pencil" className="size-4" />
                                    Edit
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => remove(period)}
                                >
                                    <Icon name="trash" className="size-4" />
                                    Delete
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={
                    editing === null || editing === "new"
                        ? "New group"
                        : `Edit ${editing.label}`
                }
            >
                {editing !== null ? (
                    <PeriodForm
                        key={editing === "new" ? "new" : editing.id}
                        period={editing === "new" ? null : editing}
                        onSaved={saved}
                        onCancel={() => setEditing(null)}
                    />
                ) : null}
            </Modal>

            <Modal
                open={members !== null}
                onClose={() => setMembers(null)}
                title={members ? `Investors in ${members.label}` : "Investors"}
            >
                {members !== null ? (
                    <MembersForm
                        key={members.id}
                        period={members}
                        investors={investors}
                        onSaved={saved}
                        onCancel={() => setMembers(null)}
                    />
                ) : null}
            </Modal>
        </PageContainer>
    );
}
