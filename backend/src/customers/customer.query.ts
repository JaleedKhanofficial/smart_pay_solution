import type { SelectQueryBuilder } from 'typeorm';
import { Customer, Guarantor } from '../database/entities';
import type { ListCustomersDto } from './dto/list-customers.dto';

/** The alias every filter and sort below is written against. */
export const CUSTOMER_ALIAS = 'customer';

/** Local midnight for a `YYYY-MM-DD` filter value. */
function startOfDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

/** How many guarantors each filter option means. Positions are unique per
 *  customer and limited to 1 and 2, so a count says everything. */
const GUARANTOR_COUNTS: Record<string, number> = {
  none: 0,
  one: 1,
  two: 2,
};

/**
 * FR-CUS-01. Filters are AND-ed with each other; the free-text search stays an
 * OR across the three identifying fields.
 *
 * Soft-deleted customers are excluded by TypeORM itself — `deleted_at` is a
 * @DeleteDateColumn — so there is no `deletedAt IS NULL` to remember here.
 */
export function applyCustomerFilters(
  qb: SelectQueryBuilder<Customer>,
  query: ListCustomersDto,
): void {
  if (query.search) {
    qb.andWhere(
      `(${CUSTOMER_ALIAS}.fullName ILIKE :search
        OR ${CUSTOMER_ALIAS}.cnicNumber LIKE :search
        OR ${CUSTOMER_ALIAS}.mobileNumber LIKE :search)`,
      { search: `%${query.search}%` },
    );
  }

  if (query.occupation) {
    qb.andWhere(`LOWER(${CUSTOMER_ALIAS}.occupation) = LOWER(:occupation)`, {
      occupation: query.occupation,
    });
  }

  if (query.cnicImage) {
    qb.andWhere(
      query.cnicImage === 'with'
        ? `${CUSTOMER_ALIAS}.cnicFileId IS NOT NULL`
        : `${CUSTOMER_ALIAS}.cnicFileId IS NULL`,
    );
  }

  if (query.guarantors) {
    const expected = GUARANTOR_COUNTS[query.guarantors];

    // Built through the query builder rather than as raw SQL so the table stays
    // schema-qualified and the column names stay tied to the entity.
    const countSubQuery = qb
      .subQuery()
      .select('COUNT(*)')
      .from(Guarantor, 'g')
      .where(`g.customerId = ${CUSTOMER_ALIAS}.id`)
      .getQuery();

    qb.andWhere(`(${countSubQuery}) = :guarantorCount`, {
      guarantorCount: expected,
    });
  }

  if (query.addedFrom) {
    qb.andWhere(`${CUSTOMER_ALIAS}.createdAt >= :addedFrom`, {
      addedFrom: startOfDay(query.addedFrom),
    });
  }

  if (query.addedTo) {
    // Inclusive of the whole day the user picked.
    const end = startOfDay(query.addedTo);
    end.setDate(end.getDate() + 1);

    qb.andWhere(`${CUSTOMER_ALIAS}.createdAt < :addedTo`, { addedTo: end });
  }
}

/**
 * NFR-13.5. The column is whitelisted by ListCustomersDto, so it can never be
 * an arbitrary reference; `id` breaks ties so rows cannot shuffle between pages
 * when the sorted column holds duplicates.
 */
export function applyCustomerSort(
  qb: SelectQueryBuilder<Customer>,
  query: ListCustomersDto,
): void {
  qb.orderBy(
    `${CUSTOMER_ALIAS}.${query.sort}`,
    query.dir === 'asc' ? 'ASC' : 'DESC',
  ).addOrderBy(`${CUSTOMER_ALIAS}.id`, 'DESC');
}
