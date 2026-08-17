import type { Metadata } from "next";
import CustomersManager from "./customers-manager";
import { getCustomers } from "@/lib/customers";
import type { Customer } from "@/types/customer";

export const metadata: Metadata = {
    title: "Customers",
    description: "Manage customer records",
};

export default async function CustomersPage() {
    let customers: Customer[] = [];
    let loadError: string | null = null;

    try {
        customers = await getCustomers();
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load customers: ${error.message}`
                : "Could not load customers.";
    }

    return <CustomersManager customers={customers} loadError={loadError} />;
}
