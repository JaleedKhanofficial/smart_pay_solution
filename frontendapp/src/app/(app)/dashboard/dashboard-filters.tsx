"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ComboboxField } from "@/components/ui/combobox";

const FIELD =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none";

const LABEL =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

/**
 * FR-DSH-13 and FR-DSH-16. One row of filters above everything they scope:
 * dates first, since that is the control every reader reaches for, then the
 * investor, then Search.
 *
 * The choices go into the query string and the page re-renders on the
 * server, so a filtered dashboard is a URL — bookmarkable, and the same one
 * the server would render for anybody else. Nothing applies until Search,
 * so a half-typed range never fires a request.
 */
export function DashboardFilters({
    investors,
    investor,
    from,
    to,
}: {
    investors: { id: number; label: string }[];
    investor: string;
    from: string;
    to: string;
}) {
    const router = useRouter();
    const [draft, setDraft] = useState({ investor, from, to });

    function go(next: { investor: string; from: string; to: string }) {
        const params = new URLSearchParams();

        if (next.investor) params.set("investor", next.investor);
        if (next.from) params.set("from", next.from);
        if (next.to) params.set("to", next.to);

        const query = params.toString();

        router.push(query ? `/dashboard?${query}` : "/dashboard");
    }

    const options = [
        { value: "all", label: "All investors" },
        ...investors.map((row) => ({ value: String(row.id), label: row.label })),
    ];

    const filtered = Boolean(investor || from || to);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                go(draft);
            }}
            className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(14rem,1fr)_auto]"
        >
            <div>
                <label className={LABEL} htmlFor="dashboard-from">
                    From
                </label>
                <input
                    id="dashboard-from"
                    type="date"
                    value={draft.from}
                    max={draft.to || undefined}
                    onChange={(event) =>
                        setDraft({ ...draft, from: event.target.value })
                    }
                    className={FIELD}
                />
            </div>

            <div>
                <label className={LABEL} htmlFor="dashboard-to">
                    To
                </label>
                <input
                    id="dashboard-to"
                    type="date"
                    value={draft.to}
                    min={draft.from || undefined}
                    onChange={(event) =>
                        setDraft({ ...draft, to: event.target.value })
                    }
                    className={FIELD}
                />
            </div>

            <ComboboxField
                label="Investor"
                name="investor"
                options={options}
                defaultValue={investor || "all"}
                onValueChange={(value) =>
                    setDraft({
                        ...draft,
                        investor: value === "all" ? "" : value,
                    })
                }
            />

            <div className="flex gap-2">
                <Button type="submit">
                    <Icon name="search" className="size-4" />
                    Search
                </Button>
                {filtered ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraft({ investor: "", from: "", to: "" });
                            go({ investor: "", from: "", to: "" });
                        }}
                        iconOnly
                        aria-label="Clear filters"
                        title="Clear filters"
                    >
                        <Icon name="close" className="size-4" />
                    </Button>
                ) : null}
            </div>
        </form>
    );
}
