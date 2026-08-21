import type { Metadata } from "next";
import ProductsManager from "./products-manager";
import { apiCall } from "@/lib/api";
import {
    DEFAULT_SORT,
    EMPTY_FILTERS,
    SORT_FIELDS,
    type Category,
    type Paginated,
    type Product,
    type ProductFilterValues,
    type ProductSort,
    type SortField,
} from "@/types/product";

export const metadata: Metadata = {
    title: "Products · SmartPay Solutions",
    description: "Product catalogue",
};

const EMPTY_PAGE: Paginated<Product> = {
    data: [],
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
};

type SearchParams = Partial<Record<keyof ProductFilterValues, string>> & {
    page?: string;
    flash?: string;
    sort?: string;
    dir?: string;
};

/** Anything unrecognised falls back to the default rather than erroring. */
function readSort(params: SearchParams): ProductSort {
    const field = SORT_FIELDS.includes(params.sort as SortField)
        ? (params.sort as SortField)
        : DEFAULT_SORT.field;

    const dir =
        params.dir === "asc" || params.dir === "desc"
            ? params.dir
            : DEFAULT_SORT.dir;

    return { field, dir };
}

export default async function ProductsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const filters: ProductFilterValues = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
            (Object.keys(EMPTY_FILTERS) as (keyof ProductFilterValues)[]).map(
                (key) => [key, params[key]?.trim() ?? ""]
            )
        ),
    };

    const page = Math.max(1, Number(params.page ?? 1) || 1);
    const sort = readSort(params);

    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) {
        if (value) query.set(key, value);
    }
    query.set("sort", sort.field);
    query.set("dir", sort.dir);

    let products = EMPTY_PAGE;
    let loadError: string | null = null;

    try {
        products = await apiCall<Paginated<Product>>(
            `/products?${query.toString()}`
        );
    } catch (error) {
        loadError =
            error instanceof Error
                ? `Could not load products: ${error.message}`
                : "Could not load products.";
    }

    // Drives the category dropdown, so it can only offer real categories.
    const categories = await apiCall<Category[]>("/product-categories").catch(
        () => [] as Category[]
    );

    return (
        <ProductsManager
            page={products}
            filters={filters}
            sort={sort}
            categories={categories}
            flash={params.flash}
            loadError={loadError}
        />
    );
}
