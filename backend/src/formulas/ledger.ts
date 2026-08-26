import type { IsoDate } from './dates';
import { toAmount, toPaisa, type Paisa } from './money';

/**
 * BR-13. Applying money to a plan, oldest installment first.
 *
 * Payments are never matched to installments row by row — the customer hands
 * over cash, not "installment four" — so what a plan owes at any moment is a
 * derivation, not a stored column. This is that derivation, and it is the only
 * one: Module 6 uses it to prefill the next amount, Module 7 renders it as the
 * ledger, and FR-CON-01's past-due filter is the same reading done in SQL.
 *
 * Nothing here touches Nest, TypeORM or the database.
 */

export type ScheduleRow = {
  seq: number;
  due_date: IsoDate;
  amount: string | number;
};

export type AppliedInstallment = {
  seq: number;
  due_date: IsoDate;
  /** What the plan asks for this month. */
  amount: Paisa;
  /** How much of that the money received covers. */
  applied: Paisa;
  /** `amount - applied`; zero once the row is fully covered. */
  outstanding: Paisa;
  settled: boolean;
};

export type LedgerApplication = {
  rows: AppliedInstallment[];
  /**
   * The first row not fully covered — what to collect next, and what to
   * prefill. Null when the whole plan is settled.
   */
  next: AppliedInstallment | null;
  /** Total the plan asks for; the schedule sums to the financed amount. */
  scheduled: Paisa;
  /** What was received, echoed back so a caller need not re-add it. */
  paid: Paisa;
  /** Received beyond the whole schedule. Non-zero only with FR-PAY-06-v2 on. */
  unapplied: Paisa;
};

/**
 * `paid` is the total of non-voided payments, in paisa. The schedule is taken
 * in `seq` order regardless of the order given, because "oldest first" is the
 * rule and a caller sorting differently must not change the answer.
 */
export function applyFifo(
  schedule: ScheduleRow[],
  paid: Paisa,
): LedgerApplication {
  if (paid < 0) {
    throw new Error('paid amount cannot be negative');
  }

  const ordered = [...schedule].sort((a, b) => a.seq - b.seq);

  let remaining = paid;
  let scheduled = 0;

  const rows = ordered.map((row) => {
    const amount = toPaisa(row.amount);

    if (amount < 0) {
      throw new Error(`installment ${row.seq} has a negative amount`);
    }

    scheduled += amount;

    const applied = Math.min(remaining, amount);
    remaining -= applied;

    return {
      seq: row.seq,
      due_date: row.due_date,
      amount,
      applied,
      outstanding: amount - applied,
      settled: applied === amount,
    };
  });

  return {
    rows,
    next: rows.find((row) => !row.settled) ?? null,
    scheduled,
    paid,
    // Whatever the schedule could not absorb. A plan is settled the moment
    // `paid >= scheduled`, so this is the overpayment, not a rounding crumb.
    unapplied: remaining,
  };
}

/**
 * BR-12's test, and the figure FR-PAY-06-v2 measures an amount against.
 * Never below zero: a settled plan owes nothing, it does not owe backwards.
 */
export function outstandingOf(financed: Paisa, paid: Paisa): Paisa {
  return Math.max(0, financed - paid);
}

/** Convenience for a response: the same figure as a money string. */
export function outstandingAmount(
  financed: string | number,
  paid: Paisa,
): string {
  return toAmount(outstandingOf(toPaisa(financed), paid));
}
