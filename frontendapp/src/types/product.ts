import type { FormState, Paginated } from "./customer";

export type ProductStatus = "Active" | "Inactive";

export const PRODUCT_STATUSES: ProductStatus[] = ["Active", "Inactive"];

/** SRS §5.6 / FR-PRD-07. `product_count` drives the "in use" hint on rename. */
export type Category = {
    id: number;
    name: string;
    product_count: number;
    created_at: string;
    updated_at: string;
};

/** SRS §5.6. `category_name` is embedded so a list row needs no second lookup. */
export type Product = {
    id: number;
    name: string;
    category_id: number;
    category_name: string;
    status: ProductStatus;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

/** Columns the catalogue can be ordered by; mirrors the API whitelist. */
export const SORT_FIELDS = [
    "name",
    "category",
    "status",
    "created_at",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type ProductSort = { field: SortField; dir: SortDirection };

/** FR-PRD-01 asks for name ascending, which is how a catalogue is read. */
export const DEFAULT_SORT: ProductSort = { field: "name", dir: "asc" };

/** Every filter the catalogue accepts, as it appears in the URL. */
export type ProductFilterValues = {
    search: string;
    category_id: string;
    status: string;
};

export const EMPTY_FILTERS: ProductFilterValues = {
    search: "",
    category_id: "",
    status: "",
};

export type { FormState, Paginated };
