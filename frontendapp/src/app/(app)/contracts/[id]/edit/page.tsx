import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractForm } from "../../contract-form";
import { loadPickers, withCurrent } from "../../lookups";
import { ApiError } from "@/api/api.repository";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { apiCall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ContractDetail } from "@/types/contract";

export const metadata: Metadata = {
    title: "Edit contract · SmartPay Solutions",
};

export default async function EditContractPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Contract ids are sequential integers; anything else is a 404, not a 400
    // from the API.
    if (!/^\d+$/.test(id)) notFound();

    const contract = await apiCall<ContractDetail>(`/contracts/${id}`).catch(
        (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;

            throw error;
        }
    );

    if (!contract) notFound();

    const { customers, products } = await loadPickers();

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Module 4"
                title={`Contract # ${contract.id}`}
                description={`${contract.customer_name}  |  ${contract.product_name}  |  Started ${formatDate(contract.start_date)}`}
            />

            <ContractForm
                /* BR-19. Funding is fixed at activation, so the edit form
                   offers none — see FundingPanel. */
                fundableInvestors={[]}
                contract={contract}
                customers={withCurrent(
                    customers,
                    contract.customer_id,
                    contract.customer_name
                )}
                products={withCurrent(
                    products,
                    contract.product_id,
                    contract.product_name
                )}
                /* FR-CON-07-v2: the API stamps this the moment a payment lands,
                   and refuses a term edit from then on. */
                termsLocked={contract.terms_locked_at !== null}
            />
        </PageContainer>
    );
}
