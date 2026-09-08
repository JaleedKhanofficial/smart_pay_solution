/** FR-CON-11. One investor stake, as the create form posts it. */
export type FundingLine = {
    investor_id: number;
    amount: number;
};

/**
 * Reads investor funding lines from a submitted form.
 *
 * The funding panel posts paired hidden fields (`funding_investor_id` and
 * `funding_amount`) on every row. Blank rows are ignored.
 */
export function readFundings(formData: FormData): FundingLine[] {
    const ids = formData.getAll("funding_investor_id");
    const amounts = formData.getAll("funding_amount");

    const lines: FundingLine[] = [];

    ids.forEach((raw, index) => {
        const investor_id = Number(raw);
        const amount = Number(amounts[index] ?? "");

        if (!Number.isFinite(investor_id) || investor_id < 1) return;
        if (!Number.isFinite(amount) || amount <= 0) return;

        lines.push({ investor_id, amount });
    });

    return lines;
}

/** True when at least one complete investor line was posted. */
export function hasInvestorFunding(formData: FormData): boolean {
    return readFundings(formData).length > 0;
}

/**
 * What the posted lines come to, in whole paisa.
 *
 * Paisa because the total is compared against the purchase price for equality,
 * and 0.1 + 0.2 has no business deciding whether a contract may be saved.
 */
export function fundedTotal(formData: FormData): number {
    return readFundings(formData).reduce(
        (sum, line) => sum + Math.round(line.amount * 100),
        0
    );
}
