import type { Product, ProductCategory } from '../database/entities';
import type { ProductStatus } from '../common/enums';

/** SRS §5.6 / FR-PRD-07. */
export type CategoryResponse = {
  id: number;
  name: string;
  /** Live products filed under it — what makes a rename consequential. */
  product_count: number;
  created_at: string;
  updated_at: string;
};

/** SRS §5.6. The category is embedded so a list row needs no second lookup. */
export type ProductResponse = {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    category_id: product.category_id,
    // The join is always requested by the query; the fallback only guards a
    // caller that forgot, rather than throwing on a null relation.
    category_name: product.category?.name ?? '',
    status: product.status,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
    deleted_at: product.deleted_at?.toISOString() ?? null,
  };
}

export function toCategoryResponse(
  category: ProductCategory,
  product_count: number,
): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    product_count,
    created_at: category.created_at.toISOString(),
    updated_at: category.updated_at.toISOString(),
  };
}

/** The audit trail stores JSONB; both shapes are already free of Date instances. */
export function toAuditSnapshot(
  value: ProductResponse | CategoryResponse,
): Record<string, unknown> {
  return { ...value };
}
