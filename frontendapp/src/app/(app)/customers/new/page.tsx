import type { Metadata } from "next";
import { CustomerForm } from "../customer-form";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
    title: "Add customer · SmartPay Solutions",
};

export default function NewCustomerPage() {
    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 2"
                title="Add customer"
                description="Customer details, two guarantors and up to three CNIC images."
            />

            <CustomerForm customer={null} />
        </PageContainer>
    );
}
