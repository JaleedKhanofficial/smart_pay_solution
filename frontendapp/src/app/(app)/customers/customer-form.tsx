"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCustomer } from "./actions";
import {
    ImageField,
    MaskedField,
    TextAreaField,
    TextField,
} from "@/components/form-fields";
import { EMPTY_FORM_STATE, type Customer, type Guarantor } from "@/types/customer";

type Props = {
    customer: Customer | null;
};

function guarantorAt(customer: Customer | null, position: number): Guarantor | undefined {
    return customer?.guarantors.find((row) => row.position === position);
}

function Section({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">
                    {title}
                </h2>
                <p className="mt-0.5 text-xs text-muted">{description}</p>
            </div>
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
                {children}
            </div>
        </section>
    );
}

export function CustomerForm({ customer }: Props) {
    const isEditing = customer !== null;

    const [state, formAction, pending] = useActionState(
        saveCustomer.bind(null, customer?.id ?? null),
        EMPTY_FORM_STATE
    );

    const g1 = guarantorAt(customer, 1);
    const g2 = guarantorAt(customer, 2);

    return (
        <form action={formAction} className="flex flex-col gap-6">
            <Section
                title="Customer"
                description="CNIC and mobile are reformatted as you type and validated again on the server."
            >
                <TextField
                    label="Full name"
                    name="fullName"
                    required
                    maxLength={150}
                    defaultValue={customer?.fullName ?? ""}
                    placeholder="Enter Name"
                />
                <TextField
                    label="Father / husband name"
                    name="fatherHusbandName"
                    required
                    maxLength={150}
                    defaultValue={customer?.fatherHusbandName ?? ""}
                    placeholder="Enter Father / Husband Name"
                />
                <MaskedField
                    label="CNIC"
                    name="cnicNumber"
                    mask="cnic"
                    required
                    defaultValue={customer?.cnicNumber ?? ""}
                />
                <MaskedField
                    label="Mobile #"
                    name="mobileNumber"
                    mask="mobile"
                    required
                    defaultValue={customer?.mobileNumber ?? ""}
                />
                <TextField
                    label="Occupation"
                    name="occupation"
                    maxLength={120}
                    defaultValue={customer?.occupation ?? ""}
                    placeholder="Enter Occupation"
                />
                <TextField
                    label="Monthly income (Rs.)"
                    name="monthlyIncome"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={customer?.monthlyIncome ?? ""}
                    placeholder="30,000"
                />
                <div className="sm:col-span-2">
                    <TextAreaField
                        label="Address"
                        name="address"
                        required
                        rows={2}
                        maxLength={500}
                        defaultValue={customer?.address ?? ""}
                        placeholder="House 12, Street 5"
                    />
                </div>
                <ImageField
                    label="CNIC image"
                    name="customerCnic"
                    existingFileId={customer?.cnicFileId}
                />
            </Section>

            {([1, 2] as const).map((position) => {
                const guarantor = position === 1 ? g1 : g2;

                return (
                    <Section
                        key={position}
                        title={`Guarantor ${position}`}
                        description="Both guarantors are required on every customer record."
                    >
                        <TextField
                            label="Full name"
                            name={`g${position}FullName`}
                            maxLength={150}
                            defaultValue={guarantor?.fullName ?? ""}
                            placeholder="Guarantor Name"
                        />
                        <TextField
                            label="Father name"
                            name={`g${position}FatherName`}
                            maxLength={150}
                            defaultValue={guarantor?.fatherName ?? ""}
                            placeholder="Father Name"
                        />
                        <TextField
                            label="Relationship"
                            name={`g${position}Relationship`}
                            maxLength={60}
                            defaultValue={guarantor?.relationship ?? ""}
                            placeholder="Enter Relationship"
                        />
                        <MaskedField
                            label="CNIC"
                            name={`g${position}CnicNumber`}
                            mask="cnic"
                            defaultValue={guarantor?.cnicNumber ?? ""}
                        />
                        <MaskedField
                            label="Mobile #"
                            name={`g${position}MobileNumber`}
                            mask="mobile"
                            defaultValue={guarantor?.mobileNumber ?? ""}
                        />
                        <ImageField
                            label="CNIC image"
                            name={`guarantor${position}Cnic`}
                            existingFileId={guarantor?.cnicFileId}
                        />
                        <div className="sm:col-span-2 lg:col-span-3">
                            <TextAreaField
                                label="Address"
                                name={`g${position}Address`}
                                rows={2}
                                maxLength={500}
                                defaultValue={guarantor?.address ?? ""}
                                placeholder="House 12, Street 5"
                            />
                        </div>
                    </Section>
                );
            })}

            {state.message ? (
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

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md bg-navy-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
                >
                    {pending
                        ? "Saving…"
                        : isEditing
                          ? "Save changes"
                          : "Create customer"}
                </button>
                <Link
                    href="/customers"
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                    Cancel
                </Link>
            </div>
        </form>
    );
}
