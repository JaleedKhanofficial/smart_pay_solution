import { allocate, toAmount, toPaisa, type Paisa } from './money';

/**
 * BR-28 to BR-31: what the business spends, and who carries it.
 *
 * Two kinds, and the difference is who the cost belongs to:
 *
 * **Common** — a pen, a laptop, a box of envelopes. Bought for the business,
 * so every investor on the books at the time carries an equal share. These sit
 * in a *period*, because the roster changes: a pot raised while six people
 * were in cannot later be divided by however many are in today.
 *
 * **Individual** — the transport and food on a trip to write one deal. The
 * cost belongs to the investor whose deal it was, whole.
 *
 * Money is in paisa throughout; only the response mappers convert to strings.
 */

/** BR-28. One investor's place in a period's split. */
export type PeriodMember = {
  investor_id: number;
  /**
   * BR-29. Excluded from the split, with a reason on the record.
   *
   * Their share is **not** redistributed across the others — the remaining
   * members each still carry exactly what they would have carried, and the
   * business absorbs the gap. Redistributing would quietly raise a bill the
   * others already agreed.
   */
  waived: boolean;
};

/** BR-28. What one investor owes out of one common pot. */
export type CommonShare = {
  investor_id: number;
  share: Paisa;
  waived: boolean;
};

export type CommonSplit = {
  /** Everything spent in the period. */
  total: Paisa;
  shares: CommonShare[];
  /** BR-29. The waived shares, which the business carries instead. */
  absorbed: Paisa;
  /** How many members the pot was actually divided between. */
  divided_between: number;
};

/**
 * BR-28. A common pot, split equally between the members who carry it.
 *
 * Equal shares, through `allocate` rather than a division rounded per person:
 * 24,550 between six is 4,091.67 each, and six of those rounded to the rupee
 * come to 24,550.02. `allocate` works in paisa and puts the residual on the
 * first share, so the parts sum to the pot exactly — the same rule BR-26
 * applies to recovery slices.
 *
 * A waived member (BR-29) is left out of the division entirely. What they
 * would have carried is reported as `absorbed`, not spread over the rest.
 */
export function splitCommonExpense(
  totalAmount: string | number,
  members: PeriodMember[],
): CommonSplit {
  const total = toPaisa(totalAmount);

  if (members.length === 0) {
    return { total, shares: [], absorbed: total, divided_between: 0 };
  }

  /**
   * Divided by **everyone on the roster**, waived or not.
   *
   * This is the whole point of BR-29: the five who remain each carry the
   * 4,091.67 they were always going to carry, and the waived sixth share is
   * absorbed. Dividing by the five who are left would silently reprice them
   * at 4,910 apiece — a bill nobody agreed to.
   */
  const portions = allocate(
    total,
    members.map(() => 1),
  );

  let absorbed = 0;

  const shares = members.map((member, index) => {
    if (member.waived) absorbed += portions[index];

    return {
      investor_id: member.investor_id,
      share: member.waived ? 0 : portions[index],
      waived: member.waived,
    };
  });

  return {
    total,
    shares,
    absorbed,
    divided_between: members.filter((member) => !member.waived).length,
  };
}

/** BR-31. What one investor carries, across every period and their own costs. */
export type InvestorExpense = {
  investor_id: number;
  /** Their share of each common pot, by period. */
  common: { period_id: number; share: Paisa; waived: boolean }[];
  common_total: Paisa;
  /** BR-30. Costs charged to them alone. */
  individual: Paisa;
  total: Paisa;
};

/**
 * BR-31. Every investor's expense position, common and individual together.
 *
 * Derived, never stored. An expense corrected or deleted changes every figure
 * that depends on it on the next read — which is why an expense is editable at
 * all, unlike an investor ledger line.
 */
export function expensesByInvestor(
  periods: {
    period_id: number;
    total: string | number;
    members: PeriodMember[];
  }[],
  individual: { investor_id: number; amount: string | number }[],
): InvestorExpense[] {
  const byInvestor = new Map<number, InvestorExpense>();

  const of = (investor_id: number): InvestorExpense => {
    const existing = byInvestor.get(investor_id);

    if (existing) return existing;

    const fresh: InvestorExpense = {
      investor_id,
      common: [],
      common_total: 0,
      individual: 0,
      total: 0,
    };

    byInvestor.set(investor_id, fresh);

    return fresh;
  };

  for (const period of periods) {
    const split = splitCommonExpense(period.total, period.members);

    for (const share of split.shares) {
      const entry = of(share.investor_id);

      entry.common.push({
        period_id: period.period_id,
        share: share.share,
        waived: share.waived,
      });
      entry.common_total += share.share;
    }
  }

  for (const row of individual) {
    of(row.investor_id).individual += toPaisa(row.amount);
  }

  for (const entry of byInvestor.values()) {
    entry.total = entry.common_total + entry.individual;
  }

  return [...byInvestor.values()].sort(
    (a, b) => b.total - a.total || a.investor_id - b.investor_id,
  );
}

/** What the business itself carries: every waived share, across every period. */
export function absorbedByHouse(
  periods: { total: string | number; members: PeriodMember[] }[],
): Paisa {
  return periods.reduce(
    (sum, period) =>
      sum + splitCommonExpense(period.total, period.members).absorbed,
    0,
  );
}

/** The money figures as the API returns them. */
export function toExpenseAmounts(entry: InvestorExpense) {
  return {
    investor_id: entry.investor_id,
    common: entry.common.map((row) => ({
      period_id: row.period_id,
      share: toAmount(row.share),
      waived: row.waived,
    })),
    common_total: toAmount(entry.common_total),
    individual: toAmount(entry.individual),
    total: toAmount(entry.total),
  };
}
