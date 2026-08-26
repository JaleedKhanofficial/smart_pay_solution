import { addMonths, installmentDueDate, type IsoDate } from './dates';
import { floorToRupee, toAmount, toPaisa, type Paisa } from './money';

/**
 * Contract pricing and scheduling: BR-01 to BR-05, plus BR-14's retail margin.
 *
 * SRS §2.5 requires this to exist exactly once and be used by both the API and
 * the browser preview, so the two cannot disagree — v1's §9.3 defect was the
 * installment figure differing between screens. Nothing here touches Nest,
 * TypeORM or the database.
 *
 * Every amount in and out is a money **string**; paisa arithmetic stays inside.
 */

export type ContractTerms = {
  /** What the business paid. Defaults to sale_price where it is not tracked. */
  cost_price?: string | number | null;
  sale_price: string | number;
  /** BR-01. Ignored when markup_amount is given. */
  markup_pct: string | number;
  /** BR-01 override in rupees; the effective percentage is recomputed for display. */
  markup_amount?: string | number | null;
  down_payment: string | number;
  plan_months: number;
  start_date: IsoDate;
};

export type ScheduledInstallment = {
  seq: number;
  due_date: IsoDate;
  amount: string;
};

export type PricedContract = {
  cost_price: string;
  sale_price: string;
  /** BR-14. sale_price − cost_price. House profit, never shared. */
  retail_margin: string;
  markup_pct: string;
  markup_amount: string;
  net_amount: string;
  down_payment: string;
  financed_amount: string;
  /** BR-04-v2 displays the base, which is every installment but the last. */
  monthly_installment: string;
  plan_months: number;
  start_date: IsoDate;
  end_date: IsoDate;
  schedule: ScheduledInstallment[];
};

/** Percentages are `NUMERIC(5,2)`, so they round to two decimals like money. */
function toPct(value: string | number): number {
  const parsed =
    typeof value === 'number' ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed)) {
    throw new Error(`"${String(value)}" is not a percentage`);
  }

  return Math.round(parsed * 100) / 100;
}

function formatPct(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * BR-04-v2. `base = floor(financed ÷ plan_months)` to whole rupees; every
 * installment but the last is `base`, and the last absorbs the remainder. The
 * schedule therefore sums to the financed amount **exactly**, which is the
 * property v1 lacked.
 *
 * Exported so the schedule can be regenerated on its own when FR-CON-07-v2
 * allows a term edit.
 */
export function buildSchedule(
  financed: Paisa,
  plan_months: number,
  start_date: IsoDate,
): { base: Paisa; schedule: ScheduledInstallment[] } {
  if (!Number.isInteger(plan_months) || plan_months < 1) {
    throw new Error(
      `plan_months must be a whole number of months, got ${plan_months}`,
    );
  }

  if (financed < 0) {
    throw new Error('financed amount cannot be negative');
  }

  const base = floorToRupee(Math.floor(financed / plan_months));
  const schedule: ScheduledInstallment[] = [];

  for (let seq = 1; seq <= plan_months; seq += 1) {
    // The last installment carries whatever flooring left behind, so the parts
    // add up to the whole rather than to "near enough".
    const amount =
      seq < plan_months ? base : financed - base * (plan_months - 1);

    schedule.push({
      seq,
      due_date: installmentDueDate(start_date, seq),
      amount: toAmount(amount),
    });
  }

  return { base, schedule };
}

/**
 * BR-01 to BR-05. Takes the raw terms a person typed and returns every derived
 * figure, which is what the server persists (FR-CON-04-v2) and what the browser
 * shows as a preview.
 */
export function priceContract(terms: ContractTerms): PricedContract {
  const sale = toPaisa(terms.sale_price);

  if (sale <= 0) {
    throw new Error('sale price must be greater than zero');
  }

  // Where cost is not tracked the whole sale price is the capital basis, which
  // is also what the v1 migration assumes (M-10).
  const cost =
    terms.cost_price === undefined || terms.cost_price === null
      ? sale
      : toPaisa(terms.cost_price);

  if (cost <= 0) {
    throw new Error('cost price must be greater than zero');
  }

  if (cost > sale) {
    throw new Error('cost price cannot exceed sale price');
  }

  // BR-01: the percentage drives the amount, unless an amount is given
  // outright — in which case the percentage is recomputed to match it.
  const overridden =
    terms.markup_amount !== undefined && terms.markup_amount !== null;

  const markup = overridden
    ? toPaisa(terms.markup_amount as string | number)
    : Math.round((sale * toPct(terms.markup_pct)) / 100);

  if (markup < 0) {
    throw new Error('markup cannot be negative');
  }

  const markup_pct = overridden
    ? toPct((markup / sale) * 100)
    : toPct(terms.markup_pct);

  const net = sale + markup; // BR-02
  const down = toPaisa(terms.down_payment);

  if (down < 0) {
    throw new Error('down payment cannot be negative');
  }

  if (down > net) {
    throw new Error('down payment cannot exceed the net amount');
  }

  const financed = net - down; // BR-03

  const { base, schedule } = buildSchedule(
    financed,
    terms.plan_months,
    terms.start_date,
  );

  return {
    cost_price: toAmount(cost),
    sale_price: toAmount(sale),
    retail_margin: toAmount(sale - cost),
    markup_pct: formatPct(markup_pct),
    markup_amount: toAmount(markup),
    net_amount: toAmount(net),
    down_payment: toAmount(down),
    financed_amount: toAmount(financed),
    monthly_installment: toAmount(base),
    plan_months: terms.plan_months,
    start_date: terms.start_date,
    // BR-05. The end date is the term's length from signing, which sits after
    // the final due date because installments fall on the 1st.
    end_date: addMonths(terms.start_date, terms.plan_months),
    schedule,
  };
}
