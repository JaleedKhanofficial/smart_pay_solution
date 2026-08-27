"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { restoreRecord } from "./actions";
import { PurgeDialog } from "./purge-dialog";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CARD_CLASS, Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type {
    BinFilterValues,
    BinRow,
    BinSummary,
} from "@/types/recycle-bin";

type Props = {
    rows: BinRow[];
    summary: BinSummary;
    filters: BinFilterValues;
    loadError: string | null;
};

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

const KIND_ICON = {
    customer: "users",
    product: "box",
    contract: "fileText",
    payment: "creditCard",
    user: "shield",
} as const;

export default function BinManager({
    rows,
    summary,
    filters,
    loadError,
}: Props) {
    const { alert } = useAlert();
    const [busy, setBusy] = useState<string | null>(null);
    const [purging, setPurging] = useState<BinRow | null>(null);
    const [, startTransition] = useTransition();

    const total = summary.reduce((sum, entry) => sum + entry.count, 0);

    function restore(row: BinRow) {
        setBusy(`${row.kind}-${row.id}`);

        startTransition(async () => {
            const result = await restoreRecord(row.kind, row.id);

            setBusy(null);

            void alert(
                result.ok
                    ? { title: result.message ?? "Restored", tone: "success" }
                    : {
                          title: "That could not be restored",
                          text: result.message ?? undefined,
                          tone: "error",
                      }
            );
        });
    }

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 10"
                title="Recycle Bin"
                description={
                    total === 0
                        ? "Nothing has been deleted."
                        : `${total} deleted record${total === 1 ? "" : "s"}. Restoring puts one back in service; purging destroys it for good.`
                }
            />

            {/* The counts double as the filter: clicking one narrows the list. */}
            <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-5">
                {summary.map((entry) => {
                    const active = filters.kind === entry.kind;

                    return (
                        <Link
                            key={entry.kind}
                            href={
                                active
                                    ? "/settings/recycle-bin"
                                    : `/settings/recycle-bin?kind=${entry.kind}`
                            }
                            className={`${CARD_CLASS} p-4 transition-colors ${
                                active
                                    ? "border-chrome-600 bg-surface-muted"
                                    : "hover:bg-surface-muted"
                            }`}
                        >
                            <p className="text-xs font-medium uppercase tracking-wide text-muted">
                                {entry.label}
                            </p>
                            <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                                {entry.count}
                            </p>
                        </Link>
                    );
                })}
            </div>

            <form
                action="/settings/recycle-bin"
                method="get"
                className={`mb-6 ${CARD_CLASS}`}
            >
                <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]">
                    <div>
                        <span className={labelClass}>Deleted on or after</span>
                        <input
                            type="date"
                            name="from"
                            defaultValue={filters.from}
                            className={controlClass}
                        />
                    </div>
                    {/* Keeps the tab selection when the date is applied. */}
                    {filters.kind ? (
                        <input
                            type="hidden"
                            name="kind"
                            value={filters.kind}
                        />
                    ) : null}
                    <div className="flex items-end gap-2">
                        <Button type="submit">Apply</Button>
                        {filters.from || filters.kind ? (
                            <Link
                                href="/settings/recycle-bin"
                                className="inline-flex items-center gap-1.5 px-2 text-sm underline-offset-4 hover:underline"
                            >
                                <Icon name="close" className="size-3.5" />
                                Clear
                            </Link>
                        ) : null}
                    </div>
                </div>
            </form>

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            <Card>
                {rows.length === 0 ? (
                    <div className="px-4 py-14 text-center">
                        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                            <Icon name="trash" className="size-5" />
                        </span>
                        <p className="text-sm font-medium text-foreground">
                            {total === 0
                                ? "The bin is empty"
                                : "Nothing matches these filters"}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                            {total === 0
                                ? "Deleted records appear here and can be restored."
                                : "Try clearing the date or picking another kind."}
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {rows.map((row) => {
                            const key = `${row.kind}-${row.id}`;

                            return (
                                <li
                                    key={key}
                                    className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                                >
                                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-muted">
                                        <Icon
                                            name={KIND_ICON[row.kind]}
                                            className="size-4"
                                        />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                                            {row.title}
                                            <Badge tone="neutral">
                                                {row.kind}
                                            </Badge>
                                        </p>
                                        <p className="truncate text-xs text-muted">
                                            {row.subtitle}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-muted">
                                            Deleted{" "}
                                            {formatDateTime(row.deleted_at)}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        {/* A blocked action is shown disabled
                                            with its reason on hover, rather
                                            than offered and then refused. */}
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => restore(row)}
                                            disabled={
                                                busy === key ||
                                                row.restore_blocked !== null
                                            }
                                            title={
                                                row.restore_blocked ??
                                                "Put this back in service"
                                            }
                                        >
                                            Restore
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => setPurging(row)}
                                            disabled={
                                                busy === key ||
                                                row.purge_blocked !== null
                                            }
                                            title={
                                                row.purge_blocked ??
                                                "Delete permanently"
                                            }
                                        >
                                            Purge
                                        </Button>
                                    </div>

                                    {row.restore_blocked ||
                                    row.purge_blocked ? (
                                        <p className="w-full text-xs text-muted">
                                            {row.restore_blocked ??
                                                row.purge_blocked}
                                        </p>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            <PurgeDialog
                row={purging}
                onClose={() => setPurging(null)}
                onDone={(message) => {
                    setPurging(null);
                    void alert({ title: message, tone: "success" });
                }}
            />
        </PageContainer>
    );
}
