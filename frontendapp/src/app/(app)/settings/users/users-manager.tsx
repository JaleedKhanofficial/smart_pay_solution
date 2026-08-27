"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteUser, setUserStatus } from "./actions";
import { UserForm } from "./user-form";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CARD_CLASS, Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatDate, formatDateTime } from "@/lib/format";
import {
    DEFAULT_SORT,
    type Paginated,
    type SortDirection,
    type SortField,
    type User,
    type UserFilterValues,
    type UserSort,
} from "@/types/user";

type Props = {
    page: Paginated<User>;
    filters: UserFilterValues;
    sort: UserSort;
    /** The signed-in admin; FR-USR-03 hides actions they cannot take. */
    selfId: number;
    loadError: string | null;
};

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

function SortableHeader({
    field,
    label,
    sort,
    hrefFor,
}: {
    field: SortField;
    label: string;
    sort: UserSort;
    hrefFor: (field: SortField, dir: SortDirection) => string;
}) {
    const active = sort.field === field;
    const nextDir: SortDirection = active && sort.dir === "asc" ? "desc" : "asc";

    return (
        <th
            className="px-4 py-3 font-medium"
            aria-sort={
                active
                    ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                    : "none"
            }
        >
            <Link
                href={hrefFor(field, nextDir)}
                className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                    active ? "text-foreground" : ""
                }`}
            >
                {label}
                <Icon
                    name={
                        active && sort.dir === "asc" ? "chevronUp" : "chevronDown"
                    }
                    className={`size-3.5 ${
                        active ? "text-brand-ink" : "text-muted/40"
                    }`}
                />
            </Link>
        </th>
    );
}

export default function UsersManager({
    page,
    filters,
    sort,
    selfId,
    loadError,
}: Props) {
    const { confirm, alert } = useAlert();
    const [editing, setEditing] = useState<User | "new" | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [, startTransition] = useTransition();

    const activeFilters = Object.values(filters).filter(Boolean).length;

    function report(result: { ok: boolean; message: string | null }) {
        void alert(
            result.ok
                ? { title: result.message ?? "Done", tone: "success" }
                : {
                      title: "That change was refused",
                      text: result.message ?? undefined,
                      tone: "error",
                  }
        );
    }

    function toggleStatus(user: User) {
        const next = user.status === "active" ? "disabled" : "active";

        setBusyId(user.id);

        startTransition(async () => {
            const result = await setUserStatus(user.id, next);

            setBusyId(null);
            report(result);
        });
    }

    async function handleDelete(user: User) {
        const confirmed = await confirm({
            title: `Delete ${user.name}?`,
            text: "The account stops working immediately and can be restored from the Recycle Bin. Everything they recorded — payments, audit entries — keeps pointing at them.",
            tone: "warning",
            confirmLabel: "Yes, delete it",
            destructive: true,
        });

        if (!confirmed) return;

        setBusyId(user.id);

        startTransition(async () => {
            const result = await deleteUser(user.id);

            setBusyId(null);
            report(result);
        });
    }

    function hrefWith(overrides: {
        page?: number;
        sort?: SortField;
        dir?: SortDirection;
    }): string {
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(filters)) {
            if (value) params.set(key, value);
        }

        const field = overrides.sort ?? sort.field;
        const dir = overrides.dir ?? sort.dir;

        if (field !== DEFAULT_SORT.field || dir !== DEFAULT_SORT.dir) {
            params.set("sort", field);
            params.set("dir", dir);
        }

        const target = overrides.page ?? page.page;
        if (target > 1) params.set("page", String(target));

        const query = params.toString();

        return query ? `/settings/users?${query}` : "/settings/users";
    }

    const pageHref = (target: number) => hrefWith({ page: target });
    const sortHref = (field: SortField, dir: SortDirection) =>
        hrefWith({ sort: field, dir, page: 1 });

    const from = (page.page - 1) * page.page_size + 1;
    const to = Math.min(page.page * page.page_size, page.total);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 9"
                title="Users"
                description={`${page.total} staff account${page.total === 1 ? "" : "s"}. An operator can run the counter; an admin can also see cost price, cancel contracts and change settings.`}
                actions={
                    <Button onClick={() => setEditing("new")} stackOnMobile>
                        <Icon name="plus" className="size-4" />
                        Add user
                    </Button>
                }
            />

            <form
                action="/settings/users"
                method="get"
                className={`mb-6 ${CARD_CLASS}`}
            >
                <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
                    <div className="relative">
                        <Icon
                            name="search"
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                        />
                        <input
                            type="search"
                            name="search"
                            defaultValue={filters.search}
                            placeholder="Search name or email"
                            className={`${controlClass} pl-9`}
                        />
                    </div>
                    <select
                        name="role"
                        defaultValue={filters.role}
                        className={controlClass}
                        aria-label="Role"
                    >
                        <option value="">All roles</option>
                        <option value="admin">Admin</option>
                        <option value="operator">Operator</option>
                    </select>
                    <select
                        name="status"
                        defaultValue={filters.status}
                        className={controlClass}
                        aria-label="Status"
                    >
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                    </select>
                    <div className="flex gap-2">
                        <Button type="submit" className="flex-1">
                            Apply
                        </Button>
                        {activeFilters > 0 ? (
                            <ButtonLink
                                href="/settings/users"
                                variant="secondary"
                                iconOnly
                                aria-label="Clear filters"
                                title="Clear filters"
                            >
                                <Icon name="close" className="size-4" />
                            </ButtonLink>
                        ) : null}
                    </div>
                </div>
            </form>

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            {/* Cards below lg, table above (NFR-12.1). */}
            <div className="flex flex-col gap-3 lg:hidden">
                {page.data.map((user) => (
                    <Card key={user.id} className="p-4">
                        <div className="flex items-start gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-muted">
                                <Icon name="shield" className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <button
                                    type="button"
                                    onClick={() => setEditing(user)}
                                    className="block max-w-full truncate text-left font-medium text-foreground underline-offset-2 hover:underline"
                                >
                                    {user.name}
                                    {user.id === selfId ? (
                                        <span className="ml-2 text-xs text-muted">
                                            (you)
                                        </span>
                                    ) : null}
                                </button>
                                <p className="truncate text-xs text-muted">
                                    {user.email}
                                </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                                <Badge
                                    tone={
                                        user.role === "admin"
                                            ? "solid"
                                            : "neutral"
                                    }
                                >
                                    {user.role}
                                </Badge>
                                <Badge
                                    tone={
                                        user.status === "active"
                                            ? "positive"
                                            : "negative"
                                    }
                                >
                                    {user.status}
                                </Badge>
                            </div>
                        </div>

                        <p className="mt-3 text-xs text-muted">
                            Last signed in{" "}
                            {user.last_login_at
                                ? formatDateTime(user.last_login_at)
                                : "never"}
                        </p>

                        <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditing(user)}
                            >
                                <Icon name="pencil" className="size-4" />
                                Edit
                            </Button>
                            {user.id === selfId ? null : (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => toggleStatus(user)}
                                        disabled={busyId === user.id}
                                    >
                                        {user.status === "active"
                                            ? "Disable"
                                            : "Enable"}
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleDelete(user)}
                                        disabled={busyId === user.id}
                                        iconOnly
                                        aria-label={`Delete ${user.name}`}
                                        title="Delete"
                                    >
                                        <Icon name="trash" className="size-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                        <tr>
                            <th className="px-4 py-3 font-medium">Sr #</th>
                            <SortableHeader
                                field="name"
                                label="Name"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="email"
                                label="Email"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="role"
                                label="Role"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="status"
                                label="Status"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <SortableHeader
                                field="last_login_at"
                                label="Last sign-in"
                                sort={sort}
                                hrefFor={sortHref}
                            />
                            <th className="px-4 py-3 text-right font-medium">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {page.data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-14 text-center text-sm text-muted"
                                >
                                    No accounts match these filters.
                                </td>
                            </tr>
                        ) : (
                            page.data.map((user, index) => (
                                <tr
                                    key={user.id}
                                    className="align-middle text-foreground transition-colors hover:bg-surface-muted"
                                >
                                    <td className="px-4 py-3 tabular-nums text-muted">
                                        {from + index}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(user)}
                                            className="text-left font-medium underline-offset-2 hover:underline"
                                        >
                                            {user.name}
                                        </button>
                                        {user.id === selfId ? (
                                            <span className="ml-2 text-xs text-muted">
                                                (you)
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-3 text-muted">
                                        {user.email}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge
                                            tone={
                                                user.role === "admin"
                                                    ? "solid"
                                                    : "neutral"
                                            }
                                        >
                                            {user.role}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge
                                            tone={
                                                user.status === "active"
                                                    ? "positive"
                                                    : "negative"
                                            }
                                        >
                                            {user.status}
                                        </Badge>
                                    </td>
                                    <td
                                        className="px-4 py-3 whitespace-nowrap tabular-nums text-muted"
                                        title={
                                            user.last_login_at
                                                ? formatDateTime(
                                                      user.last_login_at
                                                  )
                                                : undefined
                                        }
                                    >
                                        {user.last_login_at
                                            ? formatDate(user.last_login_at)
                                            : "never"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setEditing(user)}
                                                iconOnly
                                                aria-label={`Edit ${user.name}`}
                                                title="Edit"
                                            >
                                                <Icon
                                                    name="pencil"
                                                    className="size-4"
                                                />
                                            </Button>
                                            {/* FR-USR-03: an admin cannot
                                                disable or delete themselves, so
                                                the controls are not offered.
                                                The server refuses regardless. */}
                                            {user.id === selfId ? (
                                                <span className="px-2 text-xs text-muted">
                                                    —
                                                </span>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() =>
                                                            toggleStatus(user)
                                                        }
                                                        disabled={
                                                            busyId === user.id
                                                        }
                                                    >
                                                        {user.status === "active"
                                                            ? "Disable"
                                                            : "Enable"}
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(user)
                                                        }
                                                        disabled={
                                                            busyId === user.id
                                                        }
                                                        iconOnly
                                                        aria-label={`Delete ${user.name}`}
                                                        title="Delete"
                                                    >
                                                        <Icon
                                                            name="trash"
                                                            className="size-4"
                                                        />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>

            {page.total_pages > 1 ? (
                <nav className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-xs text-muted">
                        Showing {from}–{to} of {page.total}
                    </span>
                    <div className="flex items-center gap-2">
                        {page.page > 1 ? (
                            <ButtonLink
                                href={pageHref(page.page - 1)}
                                variant="secondary"
                                size="sm"
                                iconOnly
                                aria-label="Previous page"
                            >
                                <Icon name="chevronLeft" className="size-4" />
                            </ButtonLink>
                        ) : null}
                        <span className="text-xs text-muted">
                            Page {page.page} of {page.total_pages}
                        </span>
                        {page.page < page.total_pages ? (
                            <ButtonLink
                                href={pageHref(page.page + 1)}
                                variant="secondary"
                                size="sm"
                                iconOnly
                                aria-label="Next page"
                            >
                                <Icon name="chevronRight" className="size-4" />
                            </ButtonLink>
                        ) : null}
                    </div>
                </nav>
            ) : null}

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={
                    editing === null || editing === "new"
                        ? "Add user"
                        : `Edit ${editing.name}`
                }
                description={
                    editing === null || editing === "new"
                        ? "They can sign in as soon as the account is active."
                        : editing.email
                }
            >
                {editing !== null ? (
                    <UserForm
                        key={editing === "new" ? "new" : editing.id}
                        user={editing === "new" ? null : editing}
                        selfId={selfId}
                        onSaved={(message) => {
                            setEditing(null);
                            void alert({ title: message, tone: "success" });
                        }}
                        onCancel={() => setEditing(null)}
                    />
                ) : null}
            </Modal>
        </PageContainer>
    );
}
