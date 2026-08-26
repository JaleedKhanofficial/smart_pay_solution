import type { SelectQueryBuilder } from 'typeorm';
import { Contract, Installment, Payment } from '../database/entities';
import type { ListContractsDto } from './dto/list-contracts.dto';

export const CONTRACT_ALIAS = 'contract';
export const CUSTOMER_ALIAS = 'customer';
export const PRODUCT_ALIAS = 'product';

/**
 * FR-CON-01. Search reaches through to the customer and the product, because
 * that is how staff look a contract up — by who took it and what they took.
 *
 * Soft-deleted contracts are excluded by TypeORM itself (`deleted_at` is a
 * @DeleteDateColumn), so there is no `deleted_at IS NULL` to remember here.
 */
export function applyContractFilters(
  qb: SelectQueryBuilder<Contract>,
  query: ListContractsDto,
): void {
  if (query.search) {
    qb.andWhere(
      `(${CUSTOMER_ALIAS}.full_name ILIKE :search
        OR ${CUSTOMER_ALIAS}.cnic_number LIKE :search
        OR ${CUSTOMER_ALIAS}.mobile_number LIKE :search
        OR ${PRODUCT_ALIAS}.name ILIKE :search)`,
      { search: `%${query.search}%` },
    );
  }

  if (query.status) {
    qb.andWhere(`${CONTRACT_ALIAS}.status = :status`, { status: query.status });
  }

  if (query.customer_id) {
    qb.andWhere(`${CONTRACT_ALIAS}.customer_id = :customer_id`, {
      customer_id: query.customer_id,
    });
  }

  if (query.product_id) {
    qb.andWhere(`${CONTRACT_ALIAS}.product_id = :product_id`, {
      product_id: query.product_id,
    });
  }

  if (query.started_from) {
    qb.andWhere(`${CONTRACT_ALIAS}.start_date >= :started_from`, {
      started_from: query.started_from,
    });
  }

  if (query.started_to) {
    qb.andWhere(`${CONTRACT_ALIAS}.start_date <= :started_to`, {
      started_to: query.started_to,
    });
  }

  if (query.due === 'past_due') {
    applyPastDue(qb);
  }
}

/**
 * FR-DSH-12 / FR-CON-01: at least one installment due before today whose
 * scheduled amount is not yet covered by what has been paid.
 *
 * Payments are not matched to installments row by row — BR-13 applies them
 * oldest-first — so "covered" is measured against the running total the plan
 * expects by that date. That is the same FIFO reading the ledger uses, done in
 * SQL so the filter cannot disagree with the screen.
 */
function applyPastDue(qb: SelectQueryBuilder<Contract>): void {
  const paid = qb
    .subQuery()
    .select('COALESCE(SUM(p.amount), 0)')
    .from(Payment, 'p')
    .where(`p.contract_id = ${CONTRACT_ALIAS}.id`)
    .andWhere('p.deleted_at IS NULL')
    .getQuery();

  const dueToDate = qb
    .subQuery()
    .select('COALESCE(SUM(i.amount), 0)')
    .from(Installment, 'i')
    .where(`i.contract_id = ${CONTRACT_ALIAS}.id`)
    .andWhere('i.due_date < CURRENT_DATE')
    .getQuery();

  qb.andWhere(`${CONTRACT_ALIAS}.status = :past_due_status`, {
    past_due_status: 'active',
  }).andWhere(`${dueToDate} > ${paid}`);
}

/**
 * NFR-13.5. The column is whitelisted by ListContractsDto, so it can never be
 * an arbitrary reference; `id` breaks ties so rows do not shuffle between pages.
 */
export function applyContractSort(
  qb: SelectQueryBuilder<Contract>,
  query: ListContractsDto,
): void {
  const direction = query.dir === 'asc' ? 'ASC' : 'DESC';

  const column =
    query.sort === 'customer'
      ? `${CUSTOMER_ALIAS}.full_name`
      : query.sort === 'product'
        ? `${PRODUCT_ALIAS}.name`
        : `${CONTRACT_ALIAS}.${query.sort}`;

  qb.orderBy(column, direction).addOrderBy(`${CONTRACT_ALIAS}.id`, 'DESC');
}
