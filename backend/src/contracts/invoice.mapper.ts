import type { CustomerResponse } from '../customers/customer.mapper';
import type { ContractDetailResponse } from './contract.mapper';

/**
 * FR-SET-01. The letterhead block. Module 12 will make these editable; until
 * then the defaults below ship with the build, and `business_identity` in the
 * settings table overrides any of them the moment a row exists.
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

/** The settings key Module 12 will write. */
export const BUSINESS_IDENTITY_KEY = 'business_identity';

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

/** Unknown keys in the stored value are ignored; missing ones fall back. */
export function toBusinessIdentity(
  stored: Record<string, unknown> | undefined,
): BusinessIdentity {
  const text = (key: keyof BusinessIdentity): string => {
    const value = stored?.[key];

    return typeof value === 'string' && value.trim() !== ''
      ? value.trim()
      : DEFAULT_BUSINESS_IDENTITY[key];
  };

  return {
    name: text('name'),
    tagline: text('tagline'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
  };
}
