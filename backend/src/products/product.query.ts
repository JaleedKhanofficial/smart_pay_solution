import type { SelectQueryBuilder } from 'typeorm';
import type { Product } from '../database/entities';
import { CATEGORY_SORT, type ListProductsDto } from './dto/list-products.dto';

export const PRODUCT_ALIAS = 'product';
export const CATEGORY_ALIAS = 'category';

/**
 * FR-PRD-01. Search is on the name alone — a catalogue is looked up by what the
 * thing is called. Category and status are exact filters (NFR-13.2).
 *
 * Soft-deleted products are excluded by TypeORM itself (`deleted_at` is a
 * @DeleteDateColumn), so there is no `deleted_at IS NULL` to remember here.
 */
export function applyProductFilters(
  qb: SelectQueryBuilder<Product>,
  query: ListProductsDto,
): void {
  if (query.search) {
    qb.andWhere(`${PRODUCT_ALIAS}.name ILIKE :search`, {
      search: `%${query.search}%`,
    });
  }

  if (query.category_id) {
    qb.andWhere(`${PRODUCT_ALIAS}.category_id = :category_id`, {
      category_id: query.category_id,
    });
  }

  if (query.status) {
    qb.andWhere(`${PRODUCT_ALIAS}.status = :status`, { status: query.status });
  }
}

/**
 * NFR-13.5. The column is whitelisted by ListProductsDto, so it can never be an
 * arbitrary reference; `id` breaks ties so rows do not shuffle between pages.
 *
 * Sorting by category orders on the joined name rather than the foreign key,
 * because a key is not a thing anyone wants to sort by.
 */
export function applyProductSort(
  qb: SelectQueryBuilder<Product>,
  query: ListProductsDto,
): void {
  const direction = query.dir === 'desc' ? 'DESC' : 'ASC';

  const column =
    query.sort === CATEGORY_SORT
      ? `${CATEGORY_ALIAS}.name`
      : `${PRODUCT_ALIAS}.${query.sort}`;

  qb.orderBy(column, direction).addOrderBy(`${PRODUCT_ALIAS}.id`, 'DESC');
}
