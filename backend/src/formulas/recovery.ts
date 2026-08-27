import { daysBetween, type IsoDate } from './dates';
import { toAmount, toPaisa, type Paisa } from './money';

/**
 * BR-06-v2 and BR-07: grading a customer's payment behaviour.
 *
 * This is the whole of Module 7's judgement. It runs server-side and nowhere
 * else (FR-REC-01-v2), it takes plain data, and it touches no database — so
 * the ledger on screen, the archived snapshot and the tier quoted on the next
 * contract are the same reading, computed once.
 */

/** BR-06-v2. Bands by days after the due date; the labels are v1's. */
export type PunctualityBand = {
  key: 'early' | 'on_time' | 'slight_delay' | 'late' | 'very_late' | 'overdue';
  label: string;
  /** Inclusive lower bound in days late; the first band absorbs everything below. */
  from: number;
  /** Inclusive upper bound, or null for the open-ended last band. */
  to: number | null;
};

export const PUNCTUALITY_BANDS: PunctualityBand[] = [
  { key: 'early', label: 'Early — Excellent', from: 0, to: 4 },
  { key: 'on_time', label: 'On Time', from: 5, to: 9 },
  { key: 'slight_delay', label: 'Slight Delay', from: 10, to: 14 },
  { key: 'late', label: 'Late', from: 15, to: 19 },
  { key: 'very_late', label: 'Very Late', from: 20, to: 24 },
  { key: 'overdue', label: 'Overdue', from: 25, to: null },
];

/**
 * Paying *before* the due date is at least as good as paying on it, so a
 * negative lateness falls in the first band rather than off the scale.
 */
export function bandFor(days_late: number): PunctualityBand {
  const found = PUNCTUALITY_BANDS.find(
    (band) =>
      days_late >= band.from && (band.to === null || days_late <= band.to),
  );

  return found ?? PUNCTUALITY_BANDS[0];
}

/** FR-REC-03. What a scheduled month is doing. */
export type RowStatus = 'Pending' | 'Short Paid' | 'Paid' | 'Advance';

/** Below a rupee is noise from flooring, not a variance worth reporting. */
const EXACT_TOLERANCE: Paisa = 100;

export type LedgerPayment = {
  id: number;
  amount: string | number;
  payment_date: IsoDate;
};

export type LedgerScheduleRow = {
  seq: number;
  due_date: IsoDate;
  amount: string | number;
};

export type LedgerRow = {
  seq: number;
  due_date: IsoDate;
  required: Paisa;
  applied: Paisa;
  /** `applied - required`; zero or negative, since FIFO never over-applies. */
  variance: Paisa;
  /** |variance| below a rupee — reported as Exact rather than Short Paid. */
  exact: boolean;
  status: RowStatus;
  /** FR-REC-02-v2: the date of the payment that *completed* this row. */
  completed_on: IsoDate | null;
  completed_by_payment_id: number | null;
  /** Signed: negative means settled before the due date. Null until complete. */
  days_late: number | null;
  band: PunctualityBand | null;
};

/**
 * BR-07. Awarded over **completed** installments only — a plan nobody has paid
 * into yet has no behaviour to judge (FR-REC-06 shows "Awaiting data").
 */
export type LoyaltyTier = {
  key: 'platinum' | 'gold' | 'silver' | 'caution' | 'awaiting';
  label: string;
  /** Advisory only: never applied automatically to the next contract. */
  reduction_pct: number;
  behaviour: string;
  reward: string;
};

export type LedgerSummary = {
  plan_months: number;
  completed_installments: number;
  total_payable: string;
  down_payment: string;
  financed_amount: string;
  total_paid: string;
  outstanding: string;
  /** BR-13: capped at 100, measured against the financed amount. */
  recovered_pct: string;
  /**
   * FR-REC-04. The **net** of every completed row's lateness, in days —
   * positive is lag, negative is advance. Net, not a sum of magnitudes: a
   * month paid five days early genuinely offsets one paid five days late,
   * which is the correction v1 never made.
   */
  net_days: number;
};

export type LedgerReport = {
  rows: LedgerRow[];
  summary: LedgerSummary;
  tier: LoyaltyTier;
  /** FR-REC-05. Completed rows per band, in band order, for the chart. */
  distribution: { band: PunctualityBand; count: number }[];
};

const AWAITING: LoyaltyTier = {
  key: 'awaiting',
  label: 'Awaiting data',
  reduction_pct: 0,
  behaviour: 'No installment has been completed yet.',
  reward: 'A tier is awarded once the first installment is fully paid.',
};

/** BR-07, in the order the rule states — the first test that passes wins. */
export function awardTier(bands: PunctualityBand[]): LoyaltyTier {
  if (bands.length === 0) return AWAITING;

  const share = (predicate: (band: PunctualityBand) => boolean): number =>
    bands.filter(predicate).length / bands.length;

  const withinEarly = share((band) => band.key === 'early');
  const withinOnTime = share(
    (band) => band.key === 'early' || band.key === 'on_time',
  );
  const atFifteenPlus = share(
    (band) =>
      band.key === 'late' || band.key === 'very_late' || band.key === 'overdue',
  );

  if (withinEarly === 1) {
    return {
      key: 'platinum',
      label: 'Platinum',
      reduction_pct: 5,
      behaviour: 'Every installment settled within four days of its due date.',
      reward: 'A 5% reduction may be offered on the next contract.',
    };
  }

  if (withinOnTime >= 0.8) {
    return {
      key: 'gold',
      label: 'Gold',
      reduction_pct: 3,
      behaviour:
        'At least four installments in five settled within nine days of their due date.',
      reward: 'A 3% reduction may be offered on the next contract.',
    };
  }

  if (atFifteenPlus < 0.5) {
    return {
      key: 'silver',
      label: 'Silver',
      reduction_pct: 1,
      behaviour:
        'Most installments settled inside a fortnight, with some running late.',
      reward: 'A 1% reduction may be offered on the next contract.',
    };
  }

  return {
    key: 'caution',
    label: 'Caution',
    reduction_pct: 0,
    behaviour:
      'Half or more of the installments settled fifteen days or later after their due date.',
    reward: 'Stricter terms are advised, and a guarantor is recommended.',
  };
}

/**
 * FR-REC-02-v2 / FR-REC-03 / FR-REC-04. The whole ledger, derived.
 *
 * Payments are applied oldest **payment** first to the oldest unpaid
 * installment — a single payment may span several months, and a month may take
 * several payments. The row's applied date is the date of the payment that
 * finished it, which is what BR-06-v2 grades.
 *
 * Voided payments must be filtered out by the caller: this function has no
 * notion of a void, only of money that arrived.
 */
export function buildLedger(
  schedule: LedgerScheduleRow[],
  payments: LedgerPayment[],
  totals: {
    net_amount: string | number;
    down_payment: string | number;
    financed_amount: string | number;
  },
): LedgerReport {
  const orderedSchedule = [...schedule].sort((a, b) => a.seq - b.seq);

  // Oldest money first, and `id` breaks a same-day tie so the reading is
  // stable rather than dependent on however the rows came back.
  const queue = [...payments]
    .sort((a, b) =>
      a.payment_date === b.payment_date
        ? a.id - b.id
        : a.payment_date < b.payment_date
          ? -1
          : 1,
    )
    .map((payment) => ({ ...payment, left: toPaisa(payment.amount) }));

  let cursor = 0;

  const rows: LedgerRow[] = orderedSchedule.map((row) => {
    const required = toPaisa(row.amount);
    let applied = 0;
    let completedOn: IsoDate | null = null;
    let completedBy: number | null = null;

    while (applied < required && cursor < queue.length) {
      const payment = queue[cursor];

      if (payment.left === 0) {
        cursor += 1;
        continue;
      }

      const take = Math.min(payment.left, required - applied);
      applied += take;
      payment.left -= take;

      if (applied === required) {
        completedOn = payment.payment_date;
        completedBy = payment.id;
      }
    }

    const variance = applied - required;
    const exact = Math.abs(variance) < EXACT_TOLERANCE;
    const days_late =
      completedOn === null ? null : daysBetween(row.due_date, completedOn);

    const status: RowStatus =
      applied === 0
        ? 'Pending'
        : completedOn === null
          ? 'Short Paid'
          : days_late !== null && days_late < 0
            ? 'Advance'
            : 'Paid';

    return {
      seq: row.seq,
      due_date: row.due_date,
      required,
      applied,
      variance,
      exact,
      status,
      completed_on: completedOn,
      completed_by_payment_id: completedBy,
      days_late,
      band: days_late === null ? null : bandFor(days_late),
    };
  });

  const completed = rows.filter((row) => row.completed_on !== null);
  const bands = completed.map((row) => row.band as PunctualityBand);

  const financed = toPaisa(totals.financed_amount);
  const paid = queue.reduce((sum, payment) => sum + toPaisa(payment.amount), 0);

  return {
    rows,
    summary: {
      plan_months: orderedSchedule.length,
      completed_installments: completed.length,
      total_payable: String(totals.net_amount),
      down_payment: String(totals.down_payment),
      financed_amount: String(totals.financed_amount),
      total_paid: toAmount(paid),
      outstanding: toAmount(Math.max(0, financed - paid)),
      recovered_pct:
        financed === 0
          ? '0.00'
          : Math.min(100, (paid / financed) * 100).toFixed(2),
      net_days: completed.reduce((sum, row) => sum + (row.days_late ?? 0), 0),
    },
    tier: awardTier(bands),
    distribution: PUNCTUALITY_BANDS.map((band) => ({
      band,
      count: bands.filter((row) => row.key === band.key).length,
    })),
  };
}
