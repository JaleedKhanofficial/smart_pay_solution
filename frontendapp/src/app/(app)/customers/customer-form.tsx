"use client";

import { useActionState } from "react";
import { saveCustomer } from "./actions";
import {
    ImageField,
    MaskedField,
    TextAreaField,
    TextField,
} from "@/components/form-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardFields, CardHeader } from "@/components/ui/card";
import { EMPTY_FORM_STATE, type Customer, type Guarantor } from "@/types/customer";

type Props = {
    customer: Customer | null;
};

function guarantorAt(customer: Customer | null, position: number): Guarantor | undefined {
    return customer?.guarantors.find((row) => row.position === position);
}

export function CustomerForm({ customer }: Props) {
    const isEditing = customer !== null;

    const [state, formAction, pending] = useActionState(
        saveCustomer.bind(null, customer?.id ?? null),
        EMPTY_FORM_STATE
    );

    const g1 = guarantorAt(customer, 1);
    const g2 = guarantorAt(customer, 2);

    // React 19 clears an uncontrolled form once the action returns, so after a
    // rejected save the fields are re-seeded from what was submitted. Keying on
    // the attempt number remounts them, which is what makes defaultValue apply
    // a second time.
    const initial = (name: string, stored?: string | null) =>
        state.values?.[name] ?? stored ?? "";

    return (
        <form
            key={state.attempt}
            action={formAction}
            className="flex flex-col gap-6"
        >
            <Card>
                <CardHeader
                    title="Customer"
                    description="CNIC and mobile are reformatted as you type and validated again on the server."
                />
                <CardFields wide>
                <TextField
                    label="Full name"
                    name="full_name"
                    required
                    maxLength={150}
                    defaultValue={initial("full_name", customer?.full_name)}
                    placeholder="Enter Name"
                />
                <TextField
                    label="Father / husband name"
                    name="father_husband_name"
                    required
                    maxLength={150}
                    defaultValue={initial("father_husband_name", customer?.father_husband_name)}
                    placeholder="Enter Father / Husband Name"
                />
                <MaskedField
                    label="CNIC"
                    name="cnic_number"
                    mask="cnic"
                    required
                    defaultValue={initial("cnic_number", customer?.cnic_number)}
                />
                <MaskedField
                    label="Mobile #"
                    name="mobile_number"
                    mask="mobile"
                    required
                    defaultValue={initial("mobile_number", customer?.mobile_number)}
                />
                <TextField
                    label="Occupation"
                    name="occupation"
                    maxLength={120}
                    defaultValue={initial("occupation", customer?.occupation)}
                    placeholder="Enter Occupation"
                />
                <TextField
                    label="Monthly income (Rs.)"
                    name="monthly_income"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={initial("monthly_income", customer?.monthly_income)}
                    placeholder="30,000"
                />
                <div className="sm:col-span-2">
                    <TextAreaField
                        label="Address"
                        name="address"
                        required
                        rows={2}
                        maxLength={500}
                        defaultValue={initial("address", customer?.address)}
                        placeholder="House 12, Street 5"
                    />
                </div>
                <ImageField
                    label="CNIC Front Side"
                    name="customer_cnic_front"
                    existingFileId={customer?.cnic_file_front_id}
                />
                <ImageField
                    label="CNIC Back Side"
                    name="customer_cnic_back"
                    existingFileId={customer?.cnic_file_back_id}
                />
                </CardFields>
            </Card>

            {([1, 2] as const).map((position) => {
                const guarantor = position === 1 ? g1 : g2;

                return (
                    <Card key={position}>
                        <CardHeader
                            title={`Guarantor ${position}`}
                            description={
                                position === 1
                                    ? "Required on every customer record."
                                    : "Optional — leave blank if there is no second guarantor."
                            }
                        />
                        <CardFields wide>
                        <TextField
                            label="Full name"
                            name={`g${position}_full_name`}
                            required={position === 1}
                            maxLength={150}
                            defaultValue={initial(`g${position}_full_name`, guarantor?.full_name)}
                            placeholder="Guarantor Name"
                        />
                        <TextField
                            label="Father name"
                            name={`g${position}_father_name`}
                            required={position === 1}
                            maxLength={150}
                            defaultValue={initial(`g${position}_father_name`, guarantor?.father_name)}
                            placeholder="Father Name"
                        />
                        <TextField
                            label="Relationship"
                            name={`g${position}_relationship`}
                            required={position === 1}
                            maxLength={60}
                            defaultValue={initial(`g${position}_relationship`, guarantor?.relationship)}
                            placeholder="Enter Relationship"
                        />
                        <MaskedField
                            label="CNIC"
                            name={`g${position}_cnic_number`}
                            mask="cnic"
                            required={position === 1}
                            defaultValue={initial(`g${position}_cnic_number`, guarantor?.cnic_number)}
                        />
                        <MaskedField
                            label="Mobile #"
                            name={`g${position}_mobile_number`}
                            mask="mobile"
                            required={position === 1}
                            defaultValue={initial(`g${position}_mobile_number`, guarantor?.mobile_number)}
                        />
                        <ImageField
                            label="CNIC image"
                            name={`guarantor${position}_cnic`}
                            existingFileId={guarantor?.cnic_file_id}
                        />
                        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                            <TextAreaField
                                label="Address"
                                name={`g${position}_address`}
                                required={position === 1}
                                rows={2}
                                maxLength={500}
                                defaultValue={initial(`g${position}_address`, guarantor?.address)}
                                placeholder="House 12, Street 5"
                            />
                        </div>
                    </CardFields>
                    </Card>
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

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <Button type="submit" disabled={pending} stackOnMobile>
                    {pending
                        ? "Saving…"
                        : isEditing
                          ? "Save changes"
                          : "Create customer"}
                </Button>
                <ButtonLink href="/customers" variant="secondary" stackOnMobile>
                    Cancel
                </ButtonLink>
            </div>
        </form>
    );
}
