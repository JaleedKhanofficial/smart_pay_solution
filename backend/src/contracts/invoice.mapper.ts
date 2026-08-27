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
export type InvoiceResponse = {
  contract: ContractDetailResponse;
  customer: CustomerResponse;
  business: BusinessIdentity;
  /** Stamped by the server so two prints of the same contract agree. */
  issued_at: string;
};
