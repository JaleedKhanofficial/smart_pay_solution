import type { ContractStatus, ProductCondition } from '../common/enums';
import type { Contract, Installment } from '../database/entities';

/** SRS §5.8. One scheduled month of the plan (BR-04-v2, BR-05). */
export type InstallmentResponse = {
  id: number;
  seq: number;
  due_date: string;
  amount: string;
};

/**
 * SRS §5.7. Money stays a string end to end so no figure is ever rounded
 * through a float, and dates are the `YYYY-MM-DD` the column holds.
 *
 * `cost_price` is returned to every role. NFR-15 kept it from an operator when
 * cost and sale were separate figures, but the business applies its markup to
 * what it paid, so the two are the same number and hiding one while showing the
 * other protects nothing (SRS §2.7 item 15). What stays admin-only is the
 * investor side: `house_funded_amount` here, and all of Module 13.
 */
export type ContractResponse = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_cnic: string;
  product_id: number;
  product_name: string;
  cost_price: string;
  sale_price: string;
  markup_pct: string;
  markup_amount: string;
  net_amount: string;
  down_payment: string;
  financed_amount: string;
  monthly_installment: string;
  plan_months: number;
  product_condition: ProductCondition;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  write_off: boolean;
  /** FR-CON-07-v2. Set once a payment exists and the terms stop being editable. */
  terms_locked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ContractDetailResponse = ContractResponse & {
  installments: InstallmentResponse[];
  /**
   * FR-CON-11. Zero rows means the deal is entirely house-funded, which is a
   * real state and not an error — FR-CON-13 allows it explicitly.
   */
  house_funded_amount: string | null;
};

function toInstallmentResponse(installment: Installment): InstallmentResponse {
  return {
    id: installment.id,
    seq: installment.seq,
    due_date: installment.due_date,
    amount: installment.amount,
  };
}

/**
 * NFR-15 now bites on the investor figures alone — see the note on
 * ContractResponse — so the register response needs no role at all. The detail
 * mapper still takes one, because `house_funded_amount` is gated on it.
 */
export function toContractResponse(contract: Contract): ContractResponse {
  return {
    id: contract.id,
    customer_id: contract.customer_id,
    customer_name: contract.customer?.full_name ?? '',
    customer_cnic: contract.customer?.cnic_number ?? '',
    product_id: contract.product_id,
    product_name: contract.product?.name ?? '',
    cost_price: contract.cost_price,
    sale_price: contract.sale_price,
    markup_pct: contract.markup_pct,
    markup_amount: contract.markup_amount,
    net_amount: contract.net_amount,
    down_payment: contract.down_payment,
    financed_amount: contract.financed_amount,
    monthly_installment: contract.monthly_installment,
    plan_months: contract.plan_months,
    product_condition: contract.product_condition,
    start_date: contract.start_date,
    end_date: contract.end_date,
    status: contract.status,
    write_off: contract.write_off,
    terms_locked_at: contract.terms_locked_at?.toISOString() ?? null,
    notes: contract.notes,
    created_at: contract.created_at.toISOString(),
    updated_at: contract.updated_at.toISOString(),
    deleted_at: contract.deleted_at?.toISOString() ?? null,
  };
}

export function toContractDetailResponse(
  contract: Contract,
  options: { include_cost: boolean; house_funded?: string | null },
): ContractDetailResponse {
  return {
    ...toContractResponse(contract),
    // Sorted here rather than in the query: paginating a joined one-to-many
    // makes TypeORM select ids through a subquery that can only order by the
    // root table's columns.
    installments: (contract.installments ?? [])
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map(toInstallmentResponse),
    // BR-14. The caller reads this from the funding rows. The fallback is the
    // full cost because a contract with no funding *is* wholly house-funded —
    // but a caller that has fundings and omits this would report a lie, so
    // every detail path passes it explicitly.
    house_funded_amount: options.include_cost
      ? (options.house_funded ?? contract.cost_price)
      : null,
  };
}

/** The audit trail stores JSONB; the response shape is already free of Dates. */
export function toAuditSnapshot(
  contract: ContractResponse,
): Record<string, unknown> {
  return { ...contract };
}
