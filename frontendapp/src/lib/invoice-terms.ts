/**
 * FR-INV-01..05 — the sixteen clauses printed on the agreement.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REPLACE THIS TEXT WITH THE WORDING FROM YOUR EXISTING AGREEMENT.
 *
 * These are plain-language defaults covering the ground an installment sale
 * normally covers. They were written to make the document complete and
 * printable today — they are **not** drafted or reviewed by a lawyer, and they
 * are not the clauses from the v1 system, which this file has no copy of.
 * Paste your real wording over the strings below; nothing else needs changing.
 *
 * `{business}` is substituted with the letterhead name at render time, so the
 * clauses stay correct if the business is ever renamed.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const INVOICE_TERMS: string[] = [
    "The purchaser agrees to buy the product described above on installments, on the terms set out in this agreement.",
    "Ownership of the product remains with {business} until the final installment has been paid in full.",
    "Each installment falls due on the 1st day of its month, as shown in the installment schedule above.",
    "Installments are payable at the {business} office, or by any other method {business} confirms in writing.",
    "A payment is credited only when it is received by {business}. A receipt is issued for every payment.",
    "The down payment shown above is non-refundable once the product has been delivered.",
    "The purchaser must inspect the product at the time of delivery. Delivery is taken as acceptance of its condition.",
    "The product may not be sold, transferred, pledged, or given to any other person before the final installment is paid.",
    "The purchaser must inform {business} in writing within seven days of any change of address, mobile number, or employment.",
    "If any installment remains unpaid, {business} may demand the entire outstanding balance at once.",
    "If the purchaser defaults, {business} may recover the product, and any amount already paid may be retained against the amount due.",
    "The guarantors are jointly and severally liable for the entire outstanding balance if the purchaser fails to pay.",
    "The manufacturer's warranty, where one applies, is the manufacturer's responsibility. It does not suspend or reduce any installment.",
    "Loss, theft, or damage to the product after delivery does not suspend or reduce any installment.",
    "The purchaser may settle the outstanding balance early at any time, on the terms {business} confirms in writing at that time.",
    "The purchaser and the guarantors confirm that they have read and understood this agreement, and that the details recorded above are correct.",
];

/** Substitutes the letterhead name into a clause. */
export function renderTerm(term: string, business: string): string {
    return term.replaceAll("{business}", business);
}
