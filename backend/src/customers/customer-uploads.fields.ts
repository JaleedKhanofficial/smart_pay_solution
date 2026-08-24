/**
 * The image fields a customer save may carry, named once.
 *
 * Four places need this list — the multipart interceptor, the map that narrows
 * multer's output, the validator, and the removal whitelist — and a name
 * present in one but missing from another loses the image *silently*. Deriving
 * them all from here is what stops that happening again.
 *
 * It lives in its own module rather than in the service so the DTOs can import
 * it without a cycle.
 */
export const CUSTOMER_UPLOAD_FIELDS = [
  'customer_cnic_front',
  'customer_cnic_back',
  'guarantor1_cnic_front',
  'guarantor1_cnic_back',
  'guarantor2_cnic_front',
  'guarantor2_cnic_back',
] as const;

export type CustomerUploadField = (typeof CUSTOMER_UPLOAD_FIELDS)[number];
