import type { CustomerResponse } from '../customers/customer.mapper';
import type { ContractDetailResponse } from './contract.mapper';

/**
 * FR-SET-01. The letterhead block, and the values that apply until an admin
 * sets their own. The key name, the validation and the editing all live in the
 * settings registry now — this file keeps only the shape and the fallback,
 * because the invoice is what they are for.
 */
export type BusinessIdentity = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
};

export const DEFAULT_BUSINESS_IDENTITY: BusinessIdentity = {
  name: 'SmartPay Solutions',
  tagline: 'Easy Monthly Installments',
  address: '',
  phone: '',
  email: '',
};

/**
 * FR-INV-01..05, FR-INV-07. Everything the printed agreement needs, in one
 * call: the deal, the schedule, the customer with both guarantors, and the
 * letterhead. One payload rather than three round trips, because the document
 * is only ever rendered whole.
 *
 * `cost_price` rides along on the contract but the document does not print it —
 * NFR-15 keeps the business's own figures off anything a customer holds.
 */
/** FR-INV-03. What has actually been collected against one installment. */
export type InvoiceReceipt = {
  seq: number;
  /** Applied oldest due date first (BR-13), so this is not "the payment". */
  amount: string;
  /** The date the installment was cleared; null while it is still short. */
  completed_on: string | null;
};

export type InvoiceResponse = {
  contract: ContractDetailResponse;
  customer: CustomerResponse;
  business: BusinessIdentity;
  /**
   * FR-INV-03. Collection against the schedule, by installment.
   *
   * Empty on a freshly written agreement, which is the case the printed
   * Received column was designed for — it is signed by hand as each
   * installment is taken. Once money has been applied the figure is printed
   * instead, so the same document serves as a statement.
   *
   * Derived by the same FIFO allocation as the recovery ledger (BR-13), so a
   * printed agreement and the ledger screen cannot disagree about what was
   * received.
   */
  received: InvoiceReceipt[];
  /** Stamped by the server so two prints of the same contract agree. */
  issued_at: string;
};
