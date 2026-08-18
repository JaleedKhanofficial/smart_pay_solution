import type { Metadata } from "next";
import CustomersManager from "./customers-manager";
import { apiCall } from "@/lib/api";
import type { Customer, Paginated } from "@/types/customer";

export const metadata: Metadata = {
    title: "Customers · SmartPay Solutions",
    description: "Manage customer records",
};

const EMPTY_PAGE: Paginated<Customer> = {
    data: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
};

export default async function CustomersPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; search?: string; flash?: string }>;
}) {
    const params = await searchParams;
    const search = params.search?.trim() ?? "";
    const page = Math.max(1, Number(params.page ?? 1) || 1);

    const query = new URLSearchParams({ page: String(page) });
    if (search) query.set("search", search);

    let customers = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        customers = await apiCall<Paginated<Customer>>(
            `/customers?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load customers: ${error.message}`
                : "Could not load customers.";
    }

    return (
        <CustomersManager
            page={customers}
            search={search}
            flash={params.flash}
            loadError={loadError}
        />
    );
}
