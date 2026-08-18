import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerForm } from "../../customer-form";
import { ApiError } from "@/api/api.repository";
import { PageHeader } from "@/components/page-header";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Customer } from "@/types/customer";

export const metadata: Metadata = {
    title: "Edit customer · SmartPay Solutions",
};

export default async function EditCustomerPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Customer ids are sequential integers; anything else is a 404, not a 400
    // from the API.
    if (!/^\d+$/.test(id)) notFound();

    const customer = await apiCall<Customer>(`/customers/${id}`).catch(
        (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;

            throw error;
        }
    );

    if (!customer) notFound();

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <PageHeader
                eyebrow="Module 2"
                title={customer.fullName}
                description={`CNIC ${customer.cnicNumber} · added ${formatDate(customer.createdAt)}`}
            />

            <CustomerForm customer={customer} />
        </div>
    );
}
