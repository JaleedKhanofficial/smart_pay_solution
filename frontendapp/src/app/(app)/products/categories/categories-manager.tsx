"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteCategory, saveCategory } from "../actions";
import { FlashAlert } from "@/components/flash-alert";
import { TextField } from "@/components/form-fields";
import { Icon } from "@/components/icons";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { useAlert } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EMPTY_FORM_STATE } from "@/types/customer";
import type { Category } from "@/types/product";

type Props = {
    categories: Category[];
    flash?: string;
    loadError: string | null;
};

/**
 * FR-PRD-07. A category can be added, renamed, and deleted **only while it is
 * empty**. Once a product is filed under it the name is part of the Summary
 * Report's deal dimension (FR-PRD-06), so the API refuses the delete rather
 * than cascading it — including when the only products left are soft-deleted
 * and still holding the foreign key.
 */
function CategoryRow({
    category,
    editing,
    onEdit,
    onCancel,
    onDelete,
    deleting,
}: {
    category: Category;
    editing: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onDelete: () => void;
    deleting: boolean;
}) {
    const [state, formAction, pending] = useActionState(
        saveCategory.bind(null, category.id),
        EMPTY_FORM_STATE
    );

    if (!editing) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-muted text-muted">
                    <Icon name="box" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                        {category.name}
                    </p>
                    <p className="text-xs text-muted">
                        {category.product_count === 0
                            ? "No products filed here"
                            : `${category.product_count} product${
                                  category.product_count === 1 ? "" : "s"
                              }`}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onEdit}
                        iconOnly
                        aria-label={`Rename ${category.name}`}
                        title="Rename"
                    >
                        <Icon name="pencil" className="size-4" />
                    </Button>
                    {/* Offered only while the category is empty. A category in
                        use cannot be deleted, so showing a button that always
                        fails would be worse than not showing one. */}
                    {category.product_count === 0 ? (
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={onDelete}
                            disabled={deleting}
                            iconOnly
                            aria-label={`Delete ${category.name}`}
                            title={deleting ? "Deleting…" : "Delete"}
                        >
                            <Icon name="trash" className="size-4" />
                        </Button>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <form
            key={state.attempt}
            action={formAction}
            className="flex flex-col gap-3 border-l-2 border-brand px-4 py-3 sm:px-5"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <TextField
                        label="Category name"
                        name="name"
                        required
                        maxLength={80}
                        defaultValue={state.values?.name ?? category.name}
                    />
                </div>
                <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={pending}>
                        {pending ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            </div>

            {category.product_count > 0 ? (
                <p className="text-xs text-muted">
                    {category.product_count} product
                    {category.product_count === 1 ? "" : "s"} will show the new
                    name, including on past deals in the Summary Report.
                </p>
            ) : null}

            {state.message ? (
                <p className="rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative">
                    {state.message}
                </p>
            ) : null}
        </form>
    );
}

export default function CategoriesManager({
    categories,
    flash,
    loadError,
}: Props) {
    const { confirm, alert } = useAlert();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [, startTransition] = useTransition();
    const [addState, addAction, addPending] = useActionState(
        saveCategory.bind(null, null),
        EMPTY_FORM_STATE
    );

    async function handleDelete(category: Category) {
        const confirmed = await confirm({
            title: `Delete ${category.name}?`,
            text: "Nothing is filed under it, so this removes it outright — there is no Recycle Bin for categories.",
            tone: "warning",
            confirmLabel: "Yes, delete it",
            destructive: true,
        });

        if (!confirmed) return;

        setDeletingId(category.id);

        startTransition(async () => {
            const result = await deleteCategory(category.id);

            setDeletingId(null);

            void alert(
                result.ok
                    ? { title: result.message ?? "Deleted", tone: "success" }
                    : {
                          title: "Could not delete this category",
                          text: result.message ?? undefined,
                          tone: "error",
                      }
            );
        });
    }

    return (
        <PageContainer width="narrow">
            <FlashAlert message={flash} cleanUrl="/products/categories" />

            <PageHeader
                eyebrow="Module 3"
                title="Categories"
                description="The deal dimension behind the catalogue and the Summary Report."
                actions={
                    <ButtonLink
                        href="/products"
                        variant="secondary"
                        stackOnMobile
                    >
                        <Icon name="chevronLeft" className="size-4" />
                        Back to products
                    </ButtonLink>
                }
            />

            {loadError ? (
                <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
                    {loadError}
                </p>
            ) : null}

            <Card className="mb-6">
                <CardHeader
                    title="Add a category"
                    description="A category can be deleted while it is empty; once a product is filed under it, reporting history depends on the name."
                />
                <form
                    key={addState.attempt}
                    action={addAction}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:px-5"
                >
                    <div className="flex-1">
                        <TextField
                            label="Category name"
                            name="name"
                            required
                            maxLength={80}
                            defaultValue={addState.values?.name ?? ""}
                            placeholder="Mobile Phones"
                        />
                    </div>
                    <Button type="submit" disabled={addPending} stackOnMobile>
                        <Icon name="plus" className="size-4" />
                        {addPending ? "Adding…" : "Add"}
                    </Button>
                </form>

                {addState.message ? (
                    <p className="mx-4 mb-4 rounded-md border border-negative/40 bg-negative/8 px-3 py-2 text-sm text-negative sm:mx-5">
                        {addState.message}
                    </p>
                ) : null}
            </Card>

            <Card>
                <CardHeader
                    title="In use"
                    description={`${categories.length} categor${
                        categories.length === 1 ? "y" : "ies"
                    }`}
                />
                {categories.length === 0 ? (
                    <div className="px-4 py-12 text-center sm:px-5">
                        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                            <Icon name="box" className="size-5" />
                        </span>
                        <p className="text-sm font-medium text-foreground">
                            No categories yet
                        </p>
                        <p className="mt-1 text-xs text-muted">
                            Add one above before creating a product.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {categories.map((category) => (
                            <CategoryRow
                                key={category.id}
                                category={category}
                                editing={editingId === category.id}
                                onEdit={() => setEditingId(category.id)}
                                onCancel={() => setEditingId(null)}
                                onDelete={() => void handleDelete(category)}
                                deleting={deletingId === category.id}
                            />
                        ))}
                    </div>
                )}
            </Card>

            <Badge tone="neutral" className="mt-4">
                <Icon name="alert" className="size-3" />
                Renaming updates every product and past deal filed under it
            </Badge>
        </PageContainer>
    );
}
