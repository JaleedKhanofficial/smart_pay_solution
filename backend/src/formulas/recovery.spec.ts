import { buildSchedule } from './contract';
import { toPaisa } from './money';
import {
  awardTier,
  bandFor,
  buildBands,
  buildLedger,
  PUNCTUALITY_BANDS,
  type LedgerPayment,
} from './recovery';

/** 44,000 over 8 months from 2026-09-01: 5,500 due on the 1st of Oct..May. */
const SCHEDULE = buildSchedule(toPaisa(44_000), 8, '2026-09-01').schedule;

const TOTALS = {
  net_amount: '54000.00',
  down_payment: '10000.00',
  financed_amount: '44000.00',
};

function payment(id: number, amount: number, date: string): LedgerPayment {
  return { id, amount, payment_date: date };
}

describe('bandFor (BR-06-v2)', () => {
  it.each([
    [0, 'early'],
    [4, 'early'],
    [5, 'on_time'],
    [9, 'on_time'],
    [10, 'slight_delay'],
    [14, 'slight_delay'],
    [15, 'late'],
    [19, 'late'],
    [20, 'very_late'],
    [24, 'very_late'],
    [25, 'overdue'],
    [400, 'overdue'],
  ])('%i days late falls in %s', (days, key) => {
    expect(bandFor(days).key).toBe(key);
  });

  it('treats paying early as the best band, not as off the scale', () => {
    expect(bandFor(-1).key).toBe('early');
    expect(bandFor(-30).key).toBe('early');
  });
});

describe('awardTier (BR-07)', () => {
  const band = (key: string) =>
    PUNCTUALITY_BANDS.find((entry) => entry.key === key)!;

  it('awaits data when nothing is completed', () => {
    expect(awardTier([]).key).toBe('awaiting');
  });

  it('gives Platinum only when every row is in the first band', () => {
    expect(awardTier([band('early'), band('early')]).key).toBe('platinum');
    expect(awardTier([band('early'), band('on_time')]).key).not.toBe(
      'platinum',
    );
  });

  it('gives Gold at four in five within nine days', () => {
    const bands = [
      band('early'),
      band('early'),
      band('early'),
      band('on_time'),
      band('late'),
    ];

    expect(awardTier(bands).key).toBe('gold');
  });

  it('drops to Silver when the 80% test fails but few rows are 15+', () => {
    const bands = [band('early'), band('slight_delay'), band('slight_delay')];

    expect(awardTier(bands).key).toBe('silver');
  });

  it('gives Caution once half the rows are 15 days or later', () => {
    const bands = [band('early'), band('late'), band('overdue'), band('early')];

    expect(awardTier(bands).key).toBe('caution');
  });

  it('never auto-applies: the reduction is advisory', () => {
    expect(awardTier([band('early')]).reward).toMatch(/may be offered/);
  });
});

describe('configurable thresholds (FR-SET-01)', () => {
  it('rebuilds the bands from the given bounds, last one open-ended', () => {
    const bands = buildBands([0, 2, 5, 10, 20]);

    expect(bands.map((band) => [band.from, band.to])).toEqual([
      [0, 0],
      [1, 2],
      [3, 5],
      [6, 10],
      [11, 20],
      [21, null],
    ]);
    // The labels are fixed; only where they divide moves.
    expect(bands[0].key).toBe('early');
    expect(bands[5].key).toBe('overdue');
  });

  it('grades the same lateness differently under tighter bounds', () => {
    const tight = buildBands([0, 2, 5, 10, 20]);

    expect(bandFor(3).key).toBe('early');
    expect(bandFor(3, tight).key).toBe('slight_delay');
  });

  it('lets the ledger be graded by configured bounds', () => {
    const relaxed = buildLedger(
      SCHEDULE,
      [payment(1, 5_500, '2026-10-04')],
      TOTALS,
    );
    const strict = buildLedger(
      SCHEDULE,
      [payment(1, 5_500, '2026-10-04')],
      TOTALS,
      { thresholds: [0, 2, 5, 10, 20] },
    );

    // Four days late: inside the default first band, well outside a tight one.
    expect(relaxed.rows[0].band?.key).toBe('early');
    expect(relaxed.tier.key).toBe('platinum');
    expect(strict.rows[0].band?.key).toBe('slight_delay');
    expect(strict.tier.key).toBe('silver');
  });

  it('moves the tier boundaries and the advised reductions', () => {
    const bands = buildBands();

    // Four of five inside the first two bands — exactly the default Gold bar.
    const history = [bands[0], bands[0], bands[0], bands[1], bands[2]];

    expect(awardTier(history).key).toBe('gold');
    expect(awardTier(history).reduction_pct).toBe(3);

    // Raising the bar to every row pushes the same history down to Silver.
    const strict = awardTier(history, {
      gold_min_within_pct: 100,
      silver_max_late_pct: 50,
      platinum_reduction_pct: 9,
      gold_reduction_pct: 6,
      silver_reduction_pct: 2,
    });

    expect(strict.key).toBe('silver');
    expect(strict.reduction_pct).toBe(2);
  });
});

describe('buildLedger (FR-REC-02-v2 … FR-REC-04)', () => {
  it('reports every row Pending when nothing has been paid', () => {
    const report = buildLedger(SCHEDULE, [], TOTALS);

    expect(report.rows).toHaveLength(8);
    expect(report.rows.every((row) => row.status === 'Pending')).toBe(true);
    expect(report.summary.completed_installments).toBe(0);
    expect(report.summary.total_paid).toBe('0.00');
    expect(report.summary.outstanding).toBe('44000.00');
    expect(report.summary.recovered_pct).toBe('0.00');
    expect(report.tier.key).toBe('awaiting');
  });

  it('grades a row by the payment that completed it, not the first one', () => {
    // Two part payments; the second one finishes installment 1 on the 12th.
    const report = buildLedger(
      SCHEDULE,
      [payment(1, 2_000, '2026-10-02'), payment(2, 3_500, '2026-10-12')],
      TOTALS,
    );

    const first = report.rows[0];

    expect(first.status).toBe('Paid');
    expect(first.completed_on).toBe('2026-10-12');
    expect(first.completed_by_payment_id).toBe(2);
    expect(first.days_late).toBe(11);
    expect(first.band?.key).toBe('slight_delay');
  });

  it('spreads one payment across several installments', () => {
    const report = buildLedger(
      SCHEDULE,
      [payment(1, 12_000, '2026-10-01')],
      TOTALS,
    );

    expect(report.rows[0].status).toBe('Paid');
    // Row 2 is due a month later but was settled by money that arrived on the
    // 1st of October, so it is genuinely paid in advance — a lump sum clears
    // future months early, and the grading should say so.
    expect(report.rows[1].status).toBe('Advance');
    expect(report.rows[1].days_late).toBe(-31);
    expect(report.rows[2].status).toBe('Short Paid');
    expect(report.rows[2].applied).toBe(toPaisa(1_000));
    expect(report.rows[2].completed_on).toBeNull();
    expect(report.rows[3].status).toBe('Pending');
    expect(report.summary.completed_installments).toBe(2);
  });

  it('marks a row settled before its due date as Advance', () => {
    const report = buildLedger(
      SCHEDULE,
      [payment(1, 5_500, '2026-09-25')],
      TOTALS,
    );

    expect(report.rows[0].status).toBe('Advance');
    expect(report.rows[0].days_late).toBe(-6);
    expect(report.rows[0].band?.key).toBe('early');
  });

  it('nets advance against lag rather than summing magnitudes', () => {
    const report = buildLedger(
      SCHEDULE,
      [
        payment(1, 5_500, '2026-09-26'), // 5 days early
        payment(2, 5_500, '2026-11-06'), // 5 days late
      ],
      TOTALS,
    );

    expect(report.rows[0].days_late).toBe(-5);
    expect(report.rows[1].days_late).toBe(5);
    // v1 would have reported 10 days of drift; the two genuinely cancel.
    expect(report.summary.net_days).toBe(0);
  });

  it('applies payments oldest first even when given out of order', () => {
    const report = buildLedger(
      SCHEDULE,
      [payment(2, 5_500, '2026-11-01'), payment(1, 5_500, '2026-10-01')],
      TOTALS,
    );

    expect(report.rows[0].completed_by_payment_id).toBe(1);
    expect(report.rows[1].completed_by_payment_id).toBe(2);
  });

  it('breaks a same-day tie by id so the reading is stable', () => {
    const report = buildLedger(
      SCHEDULE,
      [payment(9, 3_000, '2026-10-01'), payment(4, 2_500, '2026-10-01')],
      TOTALS,
    );

    // Same date, so id decides: 4 goes in first with 2,500 and 9 finishes the
    // row. Passing them in the other order must not change that.
    expect(report.rows[0].completed_by_payment_id).toBe(9);
    expect(report.rows[0].status).toBe('Paid');
    expect(report.rows[0].days_late).toBe(0);
  });

  it('summarises the plan and caps recovery at 100%', () => {
    const report = buildLedger(
      SCHEDULE,
      [payment(1, 44_000, '2026-10-01')],
      TOTALS,
    );

    expect(report.summary.completed_installments).toBe(8);
    expect(report.summary.total_paid).toBe('44000.00');
    expect(report.summary.outstanding).toBe('0.00');
    expect(report.summary.recovered_pct).toBe('100.00');
    expect(report.tier.key).toBe('platinum');
  });

  it('counts completed rows into the band distribution', () => {
    const report = buildLedger(
      SCHEDULE,
      [payment(1, 5_500, '2026-10-01'), payment(2, 5_500, '2026-11-20')],
      TOTALS,
    );

    const counts = Object.fromEntries(
      report.distribution.map((entry) => [entry.band.key, entry.count]),
    );

    expect(counts.early).toBe(1);
    expect(counts.late).toBe(1);
    expect(report.distribution).toHaveLength(6);
  });

  it('calls a sub-rupee shortfall Exact rather than Short Paid', () => {
    // The uneven schedule leaves the last row at an odd figure; pay all but 50p.
    const uneven = buildSchedule(toPaisa(100_003), 3, '2026-09-01').schedule;
    const report = buildLedger(uneven, [payment(1, 33_333.5, '2026-10-01')], {
      net_amount: '110003.00',
      down_payment: '10000.00',
      financed_amount: '100003.00',
    });

    expect(report.rows[0].exact).toBe(true);
    expect(report.rows[0].status).toBe('Short Paid');
  });
});
