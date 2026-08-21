import type { Metadata } from "next";
import CategoriesManager from "./categories-manager";
import { apiCall } from "@/lib/api";
import type { Category } from "@/types/product";

export const metadata: Metadata = {
    title: "Categories · SmartPay Solutions",
    description: "Product categories",
};

export default async function CategoriesPage({
    searchParams,
}: {
    searchParams: Promise<{ flash?: string }>;
}) {
    const { flash } = await searchParams;

    let categories: Category[] = [];
    let loadError: string | null = null;

    try {
        categories = await apiCall<Category[]>("/product-categories");
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load categories: ${error.message}`
                : "Could not load categories.";
    }

    return (
        <CategoriesManager
            categories={categories}
            flash={flash}
            loadError={loadError}
        />
    );
}
