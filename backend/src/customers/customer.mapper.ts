import type { Customer, Guarantor } from '../database/entities';

/** SRS §5.4. Mirrors the `Guarantor` type in frontendapp/src/types/customer.ts. */
export type GuarantorResponse = {
  id: number;
  customerId: number;
  position: number;
  fullName: string;
  fatherName: string;
  relationship: string;
  cnicNumber: string;
  mobileNumber: string;
  address: string;
  cnicFileId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * SRS §5.3. Money stays a string end to end so no value is ever rounded through
 * a float, and dates are ISO strings rather than Date objects — which is what
 * the JSON response contained anyway, and what makes this shape reusable as an
 * audit snapshot without a second formatting pass.
 */
export type CustomerResponse = {
  id: number;
  fullName: string;
  fatherHusbandName: string;
  cnicNumber: string;
  mobileNumber: string;
  address: string;
  occupation: string;
  monthlyIncome: string;
  cnicFileId: string | null;
  guarantors: GuarantorResponse[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

function toGuarantorResponse(guarantor: Guarantor): GuarantorResponse {
  return {
    id: guarantor.id,
    customerId: guarantor.customerId,
    position: guarantor.position,
    fullName: guarantor.fullName,
    fatherName: guarantor.fatherName,
    relationship: guarantor.relationship,
    cnicNumber: guarantor.cnicNumber,
    mobileNumber: guarantor.mobileNumber,
    address: guarantor.address,
    cnicFileId: guarantor.cnicFileId,
    createdAt: guarantor.createdAt.toISOString(),
    updatedAt: guarantor.updatedAt.toISOString(),
  };
}

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer.id,
    fullName: customer.fullName,
    fatherHusbandName: customer.fatherHusbandName,
    cnicNumber: customer.cnicNumber,
    mobileNumber: customer.mobileNumber,
    address: customer.address,
    occupation: customer.occupation,
    monthlyIncome: customer.monthlyIncome,
    cnicFileId: customer.cnicFileId,
    // Sorted here rather than in the query: paginating a joined one-to-many
    // makes TypeORM select ids through a subquery first, and that subquery can
    // only order by columns on the root table.
    guarantors: (customer.guarantors ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toGuarantorResponse),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    deletedAt: customer.deletedAt?.toISOString() ?? null,
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
