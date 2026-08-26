const ONES = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
];

const TENS = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
];

function underThousand(value: number): string {
    if (value === 0) return "";

    if (value < 20) return ONES[value];

    if (value < 100) {
        const rest = value % 10;

        return TENS[Math.floor(value / 10)] + (rest ? ` ${ONES[rest]}` : "");
    }

    const rest = value % 100;

    return `${ONES[Math.floor(value / 100)]} Hundred${
        rest ? ` ${underThousand(rest)}` : ""
    }`;
}

/**
 * Rupees written out, on the South Asian scale — thousand, lakh, crore — which
 * is what a Pakistani agreement is expected to carry beside the figure.
 *
 * Paisa are dropped: every figure on the contract is whole rupees by BR-04-v2,
 * which floors the installment to the rupee.
 */
export function amountInWords(amount: string | number): string {
    const rupees = Math.floor(Number(amount));

    if (!Number.isFinite(rupees) || rupees < 0) return "";
    if (rupees === 0) return "Zero Rupees Only";

    const crore = Math.floor(rupees / 10_000_000);
    const lakh = Math.floor((rupees % 10_000_000) / 100_000);
    const thousand = Math.floor((rupees % 100_000) / 1_000);
    const rest = rupees % 1_000;

    const parts = [
        crore ? `${underThousand(crore)} Crore` : "",
        lakh ? `${underThousand(lakh)} Lakh` : "",
        thousand ? `${underThousand(thousand)} Thousand` : "",
        rest ? underThousand(rest) : "",
    ].filter(Boolean);

    return `${parts.join(" ")} Rupees Only`;
}
