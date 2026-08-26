import type { PaymentMethod } from '../common/enums';
import type { Payment } from '../database/entities';

/**
 * SRS §5.9. Money stays a string end to end so no figure is rounded through a
 * float, and dates are the `YYYY-MM-DD` the column holds.
 *
 * A voided payment is present with `voided_at` and its reason set — FR-PAY-09
 * shows it struck through rather than hiding it, because a register that
 * silently drops corrections disagrees with the ledger and the audit log.
 */
export type PaymentResponse = {
  id: number;
  contract_id: number;
  customer_id: number;
  customer_name: string;
  customer_cnic: string;
  product_name: string;
  amount: string;
  payment_date: string;
  method: PaymentMethod;
  note: string | null;
  recorded_by: number;
  recorded_by_name: string;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

/** FR-PAY-03. What the collector needs before typing an amount. */
export type CollectableContract = {
  contract_id: number;
  reference: string;
  customer_id: number;
  customer_name: string;
  customer_cnic: string;
  customer_mobile: string;
  product_name: string;
  monthly_installment: string;
  financed_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  /** BR-13's next unpaid row; null only if the plan is already settled. */
  next_seq: number | null;
  next_due_date: string | null;
  /** The remainder of that row, which is what the form prefills. */
  next_amount: string | null;
  /** FR-DSH-12: the next row fell due before today. */
  past_due: boolean;
};

/** What a write returns: the payment, plus where it left the contract. */
export type PaymentWriteResult = {
  payment: PaymentResponse;
  contract: {
    id: number;
    status: string;
    paid_amount: string;
    outstanding_amount: string;
    /** BR-12 fired during this write. */
    status_changed: boolean;
  };
};

export function toPaymentResponse(payment: Payment): PaymentResponse {
  return {
    id: payment.id,
    contract_id: payment.contract_id,
    customer_id: payment.contract?.customer_id ?? 0,
    customer_name: payment.contract?.customer?.full_name ?? '',
    customer_cnic: payment.contract?.customer?.cnic_number ?? '',
    product_name: payment.contract?.product?.name ?? '',
    amount: payment.amount,
    payment_date: payment.payment_date,
    method: payment.method,
    note: payment.note,
    recorded_by: payment.recorded_by,
    recorded_by_name: payment.recordedBy?.name ?? '',
    void_reason: payment.void_reason,
    voided_at: payment.deleted_at?.toISOString() ?? null,
    created_at: payment.created_at.toISOString(),
    updated_at: payment.updated_at.toISOString(),
  };
}

/** The audit trail stores JSONB; the response shape is already free of Dates. */
export function toAuditSnapshot(
  payment: PaymentResponse,
): Record<string, unknown> {
  return { ...payment };
}
