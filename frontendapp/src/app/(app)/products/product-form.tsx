"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveProductInline } from "./actions";
import { SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE } from "@/types/customer";
import type { Category, Product } from "@/types/product";

type Props = {
    /** null adds, a product edits. */
    product: Product | null;
    categories: Category[];
    /** Closes the panel and reports the outcome. */
    onSaved: (message: string) => void;
    onCancel: () => void;
};

/**
 * Lives only inside the popup — the catalogue has no add/edit pages. The save
 * action therefore never redirects: a redirect would tear the modal's own page
 * out from under it. It revalidates the register instead and reports back here.
 */
export function ProductForm({
    product,
    categories,
    onSaved,
    onCancel,
}: Props) {
    const isEditing = product !== null;

    const [state, formAction, pending] = useActionState(
        saveProductInline.bind(null, product?.id ?? null),
        EMPTY_FORM_STATE
    );

    // Each submission bumps `attempt`, so recording the one already handled is
    // what stops a re-render from reporting the same success twice.
    const reported = useRef(0);

    useEffect(() => {
        if (!state.ok || state.attempt === reported.current) return;

        reported.current = state.attempt;
        onSaved(state.message ?? "Saved.");
    }, [state.ok, state.attempt, state.message, onSaved]);

    // React 19 clears an uncontrolled form once the action returns, so after a
    // rejected save the fields are re-seeded from what was submitted. Keying on
    // the attempt number remounts them, which is what makes defaultValue apply
    // a second time.
    const initial = (name: string, stored?: string | null) =>
        state.values?.[name] ?? stored ?? "";

    const categoryOptions = categories.map((category) => ({
        value: String(category.id),
        label: category.name,
    }));

    return (
        <form key={state.attempt} action={formAction} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <TextField
                        label="Product name"
                        name="name"
                        required
                        maxLength={150}
                        defaultValue={initial("name", product?.name)}
                        placeholder="Samsung Galaxy A55"
                    />
                </div>

                {categoryOptions.length > 0 ? (
                    <SelectField
                        label="Category"
                        name="category_id"
                        required
                        options={categoryOptions}
                        defaultValue={initial(
                            "category_id",
                            product ? String(product.category_id) : ""
                        )}
                        hint="The Summary Report's deal dimension."
                    />
                ) : (
                    // A product cannot be filed without one, so say so rather
                    // than rendering an empty dropdown.
                    <div>
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                            Category
                        </span>
                        <p className="rounded-md border border-negative/40 bg-negative/8 px-3 py-2.5 text-sm text-negative">
                            No categories yet -{" "}
                            <a
                                href="/products/categories"
                                className="underline underline-offset-2"
                            >
                                add one first
                            </a>
                            .
                        </p>
                    </div>
                )}

                <SelectField
                    label="Status"
                    name="status"
                    options={[
                        { value: "Active", label: "Active" },
                        { value: "Inactive", label: "Inactive" },
                    ]}
                    defaultValue={initial("status", product?.status ?? "Active")}
                    hint="Inactive keeps it off new contracts."
                />
            </div>

            {/* Only failures belong here. On success `message` is the
                confirmation text, which onSaved hands to the result dialog. */}
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

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onCancel} stackOnMobile>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={pending || categoryOptions.length === 0}
                    stackOnMobile
                >
                    {pending
                        ? "Saving…"
                        : isEditing
                          ? "Save changes"
                          : "Add product"}
                </Button>
            </div>
        </form>
    );
}
