import type { Metadata } from "next";
import { ContractForm } from "../contract-form";
import { loadFundableInvestors, loadPickers } from "../lookups";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
    title: "New contract · SmartPay Solutions",
};

/**
 * A page rather than a popup: the form carries the whole generated schedule,
 * which is a table in its own right and does not belong in a dialog
 * (frontendapp/STYLING.md).
 */
export default async function NewContractPage() {
    const [{ customers, products }, fundableInvestors] = await Promise.all([
        loadPickers(),
        loadFundableInvestors(),
    ]);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 4"
                title="New contract"
                description="Enter the raw terms; the server prices the plan and generates the schedule."
            />

            <ContractForm
                contract={null}
                customers={customers}
                products={products}
                termsLocked={false}
                fundableInvestors={fundableInvestors}
            />
        </PageContainer>
    );
}
