import { buildSchedule } from './contract';
import { applyFifo, outstandingOf, type ScheduleRow } from './ledger';
import { toPaisa } from './money';

/** The §O worked plan: 500,000 financed over 10 months, 50,000 each. */
function plan(): ScheduleRow[] {
  return buildSchedule(toPaisa(500_000), 10, '2027-05-01').schedule;
}

describe('applyFifo (BR-13)', () => {
  it('applies nothing when nothing has been paid', () => {
    const result = applyFifo(plan(), 0);

    expect(result.rows.every((row) => row.applied === 0)).toBe(true);
    expect(result.next?.seq).toBe(1);
    expect(result.next?.outstanding).toBe(toPaisa(50_000));
    expect(result.unapplied).toBe(0);
    expect(result.scheduled).toBe(toPaisa(500_000));
  });

  it('settles whole installments oldest first', () => {
    const result = applyFifo(plan(), toPaisa(150_000));

    expect(result.rows.slice(0, 3).every((row) => row.settled)).toBe(true);
    expect(result.rows[3].applied).toBe(0);
    expect(result.next?.seq).toBe(4);
  });

  it('leaves a part-paid installment as the next one to collect', () => {
    const result = applyFifo(plan(), toPaisa(120_000));

    expect(result.rows[2].applied).toBe(toPaisa(20_000));
    expect(result.rows[2].settled).toBe(false);
    expect(result.next?.seq).toBe(3);
    // FR-PAY-03 prefills the remainder, not the full installment: asking for
    // 50,000 again when 20,000 of it is already in would overpay the plan.
    expect(result.next?.outstanding).toBe(toPaisa(30_000));
  });

  it('reports the plan settled once every row is covered', () => {
    const result = applyFifo(plan(), toPaisa(500_000));

    expect(result.next).toBeNull();
    expect(result.unapplied).toBe(0);
    expect(outstandingOf(toPaisa(500_000), result.paid)).toBe(0);
  });

  it('carries money beyond the schedule as unapplied', () => {
    const result = applyFifo(plan(), toPaisa(520_000));

    expect(result.next).toBeNull();
    expect(result.unapplied).toBe(toPaisa(20_000));
  });

  it('reads seq order, not array order', () => {
    const reversed = [...plan()].reverse();
    const result = applyFifo(reversed, toPaisa(50_000));

    expect(result.rows[0].seq).toBe(1);
    expect(result.rows[0].settled).toBe(true);
    expect(result.next?.seq).toBe(2);
  });

  it('handles the uneven last installment the schedule can produce', () => {
    // 100,003 over 3 months: BR-04-v2 floors the base to Rs. 33,334 and the
    // last row absorbs what is left, so it is Rs. 33,335 rather than a third.
    const uneven = buildSchedule(toPaisa(100_003), 3, '2027-05-01').schedule;

    expect(uneven.map((row) => row.amount)).toEqual([
      '33334.00',
      '33334.00',
      '33335.00',
    ]);

    // Two whole installments paid: the odd last row is what remains.
    const result = applyFifo(uneven, toPaisa(66_668));

    expect(result.next?.seq).toBe(3);
    expect(result.next?.amount).toBe(toPaisa(33_335));
    expect(result.next?.outstanding).toBe(toPaisa(33_335));
    expect(result.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(
      toPaisa(100_003),
    );
  });

  it('stops part-way through a row rather than skipping it', () => {
    const uneven = buildSchedule(toPaisa(100_003), 3, '2027-05-01').schedule;
    const result = applyFifo(uneven, toPaisa(66_666));

    // Two rupees short of two installments, so row 2 is still the next one.
    expect(result.next?.seq).toBe(2);
    expect(result.next?.outstanding).toBe(toPaisa(2));
  });

  it('refuses a negative paid total rather than inventing credit', () => {
    expect(() => applyFifo(plan(), -1)).toThrow(/negative/);
  });
});

describe('outstandingOf (BR-12)', () => {
  it('never goes below zero', () => {
    expect(outstandingOf(toPaisa(1_000), toPaisa(1_500))).toBe(0);
  });

  it('is the balance while money is still owed', () => {
    expect(outstandingOf(toPaisa(1_000), toPaisa(400))).toBe(toPaisa(600));
  });
});
