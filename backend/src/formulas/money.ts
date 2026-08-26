/**
 * Money arithmetic for the formula package.
 *
 * Money is `decimal(12,2)` in the database and travels as a **string** all the
 * way to the JSON response (SRS §2.8.6). Calculations therefore happen in whole
 * **paisa** — integers — so no figure is ever rounded through a float. The
 * largest amount the column can hold is 9,999,999,999.99, which is 10^12 paisa;
 * JavaScript integers stay exact to 2^53, so there is three orders of magnitude
 * of headroom.
 *
 * Nothing here imports from Nest or TypeORM: this file is meant to be readable
 * by the browser preview as well as the API (SRS §2.5).
 */

/** A whole number of paisa. 100 paisa = 1 rupee. */
export type Paisa = number;

/** decimal(12,2) — the widest value the money columns accept. */
export const MAX_PAISA: Paisa = 999_999_999_999;

const MONEY_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a money value into paisa without going through a float.
 *
 * A string is read digit by digit and must carry at most two decimals — more
 * than that is a caller error, not something to silently round, because the
 * column cannot store it. A number is assumed already validated to two decimals
 * by its DTO and is normalised with `toFixed`.
 */
export function toPaisa(amount: string | number): Paisa {
  const text =
    typeof amount === 'number' ? amount.toFixed(2) : String(amount).trim();

  const match = MONEY_PATTERN.exec(text);

  if (!match) {
    throw new Error(`"${text}" is not a money amount with at most 2 decimals`);
  }

  const [, sign, rupees, fraction = ''] = match;
  const paisa = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));

  if (paisa > MAX_PAISA) {
    throw new Error(`"${text}" exceeds decimal(12,2)`);
  }

  return sign === '-' ? -paisa : paisa;
}

/** Formats paisa back into the `"12345.67"` shape the database and API use. */
export function toAmount(paisa: Paisa): string {
  if (!Number.isInteger(paisa)) {
    throw new Error(`${paisa} is not a whole number of paisa`);
  }

  const sign = paisa < 0 ? '-' : '';
  const absolute = Math.abs(paisa);

  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/** Rounds down to a whole rupee. Used by BR-04-v2's installment base. */
export function floorToRupee(paisa: Paisa): Paisa {
  return Math.floor(paisa / 100) * 100;
}

/**
 * BR-26. Splits `total` across `weights`, rounding each share to a whole paisa
 * and giving the residual to the **largest weight**, so the parts always sum to
 * the whole exactly. Ties go to the first of the tied entries, which keeps the
 * result stable for the same input.
 *
 * With no weight at all nothing is allocated and every share is zero — the
 * caller keeps the total, which is the "house holds it all" case.
 */
export function allocate(total: Paisa, weights: number[]): Paisa[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (weights.length === 0 || totalWeight <= 0) {
    return weights.map(() => 0);
  }

  const shares = weights.map((weight) =>
    Math.round((total * weight) / totalWeight),
  );

  const residual = total - shares.reduce((sum, share) => sum + share, 0);

  if (residual !== 0) {
    let largest = 0;

    for (let index = 1; index < weights.length; index += 1) {
      if (weights[index] > weights[largest]) largest = index;
    }

    shares[largest] += residual;
  }

  return shares;
}
