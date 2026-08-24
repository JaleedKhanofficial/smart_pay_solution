import type { Customer, Guarantor } from '../database/entities';

/** SRS §5.4. Mirrors the `Guarantor` type in frontendapp/src/types/customer.ts. */
export type GuarantorResponse = {
  id: number;
  customer_id: number;
  position: number;
  full_name: string;
  father_name: string;
  relationship: string;
  cnic_number: string;
  mobile_number: string;
  address: string;
  cnic_file_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * SRS §5.3. Money stays a string end to end so no value is ever rounded through
 * a float, and dates are ISO strings rather than Date objects — which is what
 * the JSON response contained anyway, and what makes this shape reusable as an
 * audit snapshot without a second formatting pass.
 */
export type CustomerResponse = {
  id: number;
  full_name: string;
  father_husband_name: string;
  cnic_number: string;
  mobile_number: string;
  address: string;
  occupation: string;
  monthly_income: string;
  cnic_file_front_id: string | null;
  cnic_file_back_id: string | null;
  guarantors: GuarantorResponse[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toGuarantorResponse(guarantor: Guarantor): GuarantorResponse {
  return {
    id: guarantor.id,
    customer_id: guarantor.customer_id,
    position: guarantor.position,
    full_name: guarantor.full_name,
    father_name: guarantor.father_name,
    relationship: guarantor.relationship,
    cnic_number: guarantor.cnic_number,
    mobile_number: guarantor.mobile_number,
    address: guarantor.address,
    cnic_file_id: guarantor.cnic_file_id,
    created_at: guarantor.created_at.toISOString(),
    updated_at: guarantor.updated_at.toISOString(),
  };
}

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer.id,
    full_name: customer.full_name,
    father_husband_name: customer.father_husband_name,
    cnic_number: customer.cnic_number,
    mobile_number: customer.mobile_number,
    address: customer.address,
    occupation: customer.occupation,
    monthly_income: customer.monthly_income,
    cnic_file_front_id: customer.cnic_file_front_id,
    cnic_file_back_id: customer.cnic_file_back_id,
    // Sorted here rather than in the query: paginating a joined one-to-many
    // makes TypeORM select ids through a subquery first, and that subquery can
    // only order by columns on the root table.
    guarantors: (customer.guarantors ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toGuarantorResponse),
    created_at: customer.created_at.toISOString(),
    updated_at: customer.updated_at.toISOString(),
    deleted_at: customer.deleted_at?.toISOString() ?? null,
  };
}

/**
 * The audit trail stores JSONB, and the response shape is already free of Date
 * and Decimal instances, so it doubles as the snapshot (FR-AUD-01).
 */
export function toAuditSnapshot(
  customer: CustomerResponse,
): Record<string, unknown> {
  return { ...customer };
}
