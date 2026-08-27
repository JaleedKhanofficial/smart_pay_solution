/**
 * Date arithmetic for the formula package.
 *
 * Contract dates are `date` columns — a day, with no time and no zone. They are
 * handled here as `YYYY-MM-DD` strings and taken apart into plain numbers,
 * never through `Date`: constructing a `Date` from a date-only string parses it
 * as midnight UTC, and any local-time read of that lands on the previous day
 * west of Greenwich. The register already carries that scar (NFR-13.6).
 */

/** A calendar day, `YYYY-MM-DD`. */
export type IsoDate = string;

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type Parts = { year: number; month: number; day: number };

export function parseIsoDate(value: IsoDate): Parts {
  const match = ISO_PATTERN.exec(value.trim());

  if (!match) {
    throw new Error(`"${value}" is not a YYYY-MM-DD date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`"${value}" is not a real calendar date`);
  }

  return { year, month, day };
}

export function formatIsoDate({ year, month, day }: Parts): IsoDate {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/** 1-based month, so daysInMonth(2028, 2) is 29. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Adds calendar months, clamping the day to the end of the target month:
 * 31 January plus one month is 28 February (29 in a leap year). Anything else
 * would roll into March and put an installment in the wrong month.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);

  const zeroBased = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;

  return formatIsoDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

/**
 * Whole days from `from` to `to`, signed: negative means `to` is earlier.
 *
 * Counted through a UTC epoch rather than local `Date` arithmetic, which is
 * the trap this package exists to avoid — a local midnight shifts by the
 * viewer's zone and would put a payment a day late in Karachi and on time in
 * London. y/m/d in, an integer out, no zone anywhere.
 */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);

  const MS_PER_DAY = 86_400_000;

  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
      MS_PER_DAY,
  );
}

/**
 * BR-05. Installment `seq` falls due on the **first day of the seq-th month
 * after the agreement month** — so an agreement signed any day in May has its
 * first installment due on 1 June, and the signing day never matters.
 */
export function installmentDueDate(start_date: IsoDate, seq: number): IsoDate {
  const { year, month } = parseIsoDate(start_date);

  const zeroBased = year * 12 + (month - 1) + seq;

  return formatIsoDate({
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
    day: 1,
  });
}
