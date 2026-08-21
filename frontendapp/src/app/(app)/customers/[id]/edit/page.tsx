import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerForm } from "../../customer-form";
import { ApiError } from "@/api/api.repository";
import { PageContainer } from "@/components/page-container";
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
        <PageContainer>
            <PageHeader
                eyebrow="Module 2"
                title={customer.full_name}
                description={`CNIC ${customer.cnic_number} · added ${formatDate(customer.created_at)}`}
            />

            <CustomerForm customer={customer} />
        </PageContainer>
    );
}
