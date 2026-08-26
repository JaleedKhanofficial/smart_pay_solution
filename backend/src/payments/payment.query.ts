import type { SelectQueryBuilder } from 'typeorm';
import type { Payment } from '../database/entities';
import type { ListPaymentsDto } from './dto/list-payments.dto';

export const PAYMENT_ALIAS = 'payment';
export const CONTRACT_ALIAS = 'contract';
export const CUSTOMER_ALIAS = 'customer';
export const PRODUCT_ALIAS = 'product';
export const RECORDER_ALIAS = 'recorder';

/**
 * FR-PAY-01. Search reaches through to the customer and the product, because
 * that is how a collector looks a receipt up — by who paid and for what.
 *
 * Unlike every other register in the system, this one calls `withDeleted()` in
 * the service: a voided payment is soft-deleted, and FR-PAY-09 requires it to
 * stay visible. `voided` here narrows that back down on request.
 */
export function applyPaymentFilters(
  qb: SelectQueryBuilder<Payment>,
  query: ListPaymentsDto,
): void {
  if (query.search) {
    qb.andWhere(
      `(${CUSTOMER_ALIAS}.full_name ILIKE :search
        OR ${CUSTOMER_ALIAS}.cnic_number LIKE :search
        OR ${CUSTOMER_ALIAS}.mobile_number LIKE :search
        OR ${PRODUCT_ALIAS}.name ILIKE :search
        OR ${PAYMENT_ALIAS}.note ILIKE :search)`,
      { search: `%${query.search}%` },
    );
  }

  if (query.contract_id) {
    qb.andWhere(`${PAYMENT_ALIAS}.contract_id = :contract_id`, {
      contract_id: query.contract_id,
    });
  }

  if (query.method) {
    qb.andWhere(`${PAYMENT_ALIAS}.method = :method`, { method: query.method });
  }

  if (query.paid_from) {
    qb.andWhere(`${PAYMENT_ALIAS}.payment_date >= :paid_from`, {
      paid_from: query.paid_from,
    });
  }

  if (query.paid_to) {
    qb.andWhere(`${PAYMENT_ALIAS}.payment_date <= :paid_to`, {
      paid_to: query.paid_to,
    });
  }

  // A soft-deleted contract lives in the Recycle Bin (Module 10), and its
  // payments go with it — a receipt whose contract cannot be opened is only
  // confusing. Safe by construction: FR-CON-09 refuses to delete a contract
  // that has non-voided payments, so nothing live is ever hidden here.
  qb.andWhere(`${CONTRACT_ALIAS}.deleted_at IS NULL`);

  if (query.voided === 'only') {
    qb.andWhere(`${PAYMENT_ALIAS}.deleted_at IS NOT NULL`);
  }

  if (query.voided === 'exclude') {
    qb.andWhere(`${PAYMENT_ALIAS}.deleted_at IS NULL`);
  }
}

/**
 * NFR-13.5. The column is whitelisted by ListPaymentsDto, so it can never be
 * an arbitrary reference; `id` breaks ties so rows do not shuffle between pages.
 */
export function applyPaymentSort(
  qb: SelectQueryBuilder<Payment>,
  query: ListPaymentsDto,
): void {
  const direction = query.dir === 'asc' ? 'ASC' : 'DESC';

  const column =
    query.sort === 'customer'
      ? `${CUSTOMER_ALIAS}.full_name`
      : query.sort === 'product'
        ? `${PRODUCT_ALIAS}.name`
        : `${PAYMENT_ALIAS}.${query.sort}`;

  qb.orderBy(column, direction).addOrderBy(`${PAYMENT_ALIAS}.id`, 'DESC');
}
