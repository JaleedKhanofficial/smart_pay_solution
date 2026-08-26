import { buildSchedule, priceContract } from './contract';
import { addMonths, installmentDueDate } from './dates';
import { allocate, toAmount, toPaisa } from './money';

/**
 * NFR-09 asks for unit tests on BR-01..BR-13. These cover BR-01 to BR-05 and
 * BR-26, and the §O worked scenario from the v2.6 investor amendment, which
 * that document names as the acceptance case.
 */

describe('money', () => {
  it('parses without going through a float', () => {
    expect(toPaisa('0.07')).toBe(7);
    expect(toPaisa('1234.5')).toBe(123450);
    expect(toPaisa('9999999999.99')).toBe(999999999999);
    // 0.1 + 0.2 in floating point is 0.30000000000000004; string parsing is not.
    expect(toPaisa('0.30')).toBe(30);
  });

  it('refuses precision the column cannot hold', () => {
    expect(() => toPaisa('1.234')).toThrow(/at most 2 decimals/);
    expect(() => toPaisa('abc')).toThrow();
    expect(() => toPaisa('99999999999.99')).toThrow(/decimal\(12,2\)/);
  });

  it('round-trips', () => {
    for (const value of ['0.00', '0.05', '1.10', '99.99', '123456.78']) {
      expect(toAmount(toPaisa(value))).toBe(value);
    }
  });

  describe('allocate (BR-26)', () => {
    it('gives the residual to the largest share so the parts sum to the whole', () => {
      // 100.00 split three ways cannot divide evenly.
      const shares = allocate(10000, [1, 1, 1]);

      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(10000);
      // Equal weights tie, and a tie goes to the first — which keeps the
      // result stable for the same input rather than merely "somewhere".
      expect(shares).toEqual([3334, 3333, 3333]);
    });

    it('sends the residual to the biggest weight, not the last', () => {
      const shares = allocate(10000, [1, 8, 1]);

      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(10000);
      expect(shares[1]).toBe(8000);
    });

    it('never loses a paisa across many awkward splits', () => {
      for (let total = 1; total <= 500; total += 7) {
        for (const weights of [
          [1, 2],
          [1, 1, 1],
          [70, 30],
          [1, 1, 1, 1, 1, 1, 7],
        ]) {
          const shares = allocate(total, weights);

          expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
        }
      }
    });

    it('allocates nothing when there is no weight', () => {
      expect(allocate(10000, [0, 0])).toEqual([0, 0]);
      expect(allocate(10000, [])).toEqual([]);
    });
  });
});

describe('dates', () => {
  it('clamps to the end of a short month (BR-05)', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2027-03-31', 1)).toBe('2027-04-30');
  });

  it('rolls the year over', () => {
    expect(addMonths('2027-05-15', 10)).toBe('2028-03-15');
    expect(addMonths('2027-12-01', 1)).toBe('2028-01-01');
  });

  it('puts installment k on the first of the k-th month after signing', () => {
    // The signing day never matters: any date in May bills from 1 June.
    expect(installmentDueDate('2027-05-01', 1)).toBe('2027-06-01');
    expect(installmentDueDate('2027-05-31', 1)).toBe('2027-06-01');
    expect(installmentDueDate('2027-05-15', 8)).toBe('2028-01-01');
  });

  it('rejects a date that never happened', () => {
    expect(() => installmentDueDate('2027-02-30', 1)).toThrow(
      /real calendar date/,
    );
    expect(() => installmentDueDate('15-05-2027', 1)).toThrow(/YYYY-MM-DD/);
  });
});

describe('buildSchedule (BR-04-v2)', () => {
  it('sums to the financed amount exactly, with the remainder in the last row', () => {
    // 100,000.00 over 3 months: 33,333 base, last one carries the 1.00.
    const { base, schedule } = buildSchedule(10000000, 3, '2027-05-15');

    expect(toAmount(base)).toBe('33333.00');
    expect(schedule.map((row) => row.amount)).toEqual([
      '33333.00',
      '33333.00',
      '33334.00',
    ]);

    const total = schedule.reduce((sum, row) => sum + toPaisa(row.amount), 0);

    expect(total).toBe(10000000);
  });

  it('keeps the base a whole rupee even when the financed amount is not', () => {
    const { base, schedule } = buildSchedule(
      toPaisa('50000.50'),
      10,
      '2027-05-15',
    );

    expect(toAmount(base)).toBe('5000.00');
    expect(schedule[9].amount).toBe('5000.50');
    expect(schedule.reduce((sum, row) => sum + toPaisa(row.amount), 0)).toBe(
      toPaisa('50000.50'),
    );
  });

  it('handles a single-month plan', () => {
    const { schedule } = buildSchedule(toPaisa('1234.56'), 1, '2027-05-15');

    expect(schedule).toHaveLength(1);
    expect(schedule[0].amount).toBe('1234.56');
    expect(schedule[0].due_date).toBe('2027-06-01');
  });

  it('never divides by a nonsense term', () => {
    expect(() => buildSchedule(1000, 0, '2027-05-15')).toThrow(/plan_months/);
    expect(() => buildSchedule(1000, 1.5, '2027-05-15')).toThrow(/plan_months/);
  });
});

describe('priceContract (BR-01..BR-05)', () => {
  const base = {
    sale_price: '500000.00',
    markup_pct: 20,
    down_payment: '100000.00',
    plan_months: 10,
    start_date: '2027-05-01',
  };

  it('derives markup, net, financed and the term', () => {
    const priced = priceContract(base);

    expect(priced.markup_amount).toBe('100000.00'); // BR-01
    expect(priced.net_amount).toBe('600000.00'); // BR-02
    expect(priced.financed_amount).toBe('500000.00'); // BR-03
    expect(priced.monthly_installment).toBe('50000.00'); // BR-04-v2
    expect(priced.end_date).toBe('2028-03-01'); // BR-05
    expect(priced.schedule).toHaveLength(10);
    expect(priced.schedule[0].due_date).toBe('2027-06-01');
    expect(priced.schedule[9].due_date).toBe('2028-03-01');
  });

  it('recomputes the effective percentage when the amount is overridden (BR-01)', () => {
    const priced = priceContract({ ...base, markup_amount: '75000.00' });

    expect(priced.markup_amount).toBe('75000.00');
    expect(priced.markup_pct).toBe('15.00');
    expect(priced.net_amount).toBe('575000.00');
  });

  it('treats cost price as the capital basis and the rest as retail margin (BR-14)', () => {
    const priced = priceContract({ ...base, cost_price: '450000.00' });

    expect(priced.cost_price).toBe('450000.00');
    expect(priced.retail_margin).toBe('50000.00');
    // Markup is taken on the sale price, not the cost.
    expect(priced.markup_amount).toBe('100000.00');
  });

  it('defaults cost to sale where cost is not tracked (M-10)', () => {
    const priced = priceContract(base);

    expect(priced.cost_price).toBe('500000.00');
    expect(priced.retail_margin).toBe('0.00');
  });

  it('rejects terms that cannot be honoured', () => {
    expect(() => priceContract({ ...base, sale_price: '0.00' })).toThrow(
      /sale price/,
    );
    expect(() => priceContract({ ...base, cost_price: '600000.00' })).toThrow(
      /cost price cannot exceed/,
    );
    expect(() => priceContract({ ...base, down_payment: '700000.00' })).toThrow(
      /down payment cannot exceed/,
    );
  });

  it('allows a fully paid contract with nothing financed', () => {
    const priced = priceContract({ ...base, down_payment: '600000.00' });

    expect(priced.financed_amount).toBe('0.00');
    expect(priced.schedule.every((row) => row.amount === '0.00')).toBe(true);
  });
});

describe('the §O worked scenario', () => {
  // The v2.6 investor amendment names this as the acceptance case, so the
  // pricing half of it is asserted here; the investor half follows with
  // Module 13.
  const priced = priceContract({
    cost_price: '500000.00',
    sale_price: '500000.00',
    markup_pct: 20,
    down_payment: '100000.00',
    plan_months: 10,
    start_date: '2027-05-01',
  });

  it('matches every figure in the scenario', () => {
    expect(priced.markup_amount).toBe('100000.00');
    expect(priced.net_amount).toBe('600000.00');
    expect(priced.financed_amount).toBe('500000.00');
    expect(priced.monthly_installment).toBe('50000.00');
    expect(priced.retail_margin).toBe('0.00');
  });

  it('recovers exactly the net amount over the down payment and ten installments', () => {
    const installments = priced.schedule.reduce(
      (sum, row) => sum + toPaisa(row.amount),
      0,
    );

    expect(installments + toPaisa(priced.down_payment)).toBe(
      toPaisa(priced.net_amount),
    );
  });

  it('splits the markup between investor and house (BR-17)', () => {
    // A funds 100% of the cost at a 50% profit share, so entitlement is half
    // the markup and the house keeps the other half — the scenario's point
    // that the last 50,000 does not belong to the investor.
    const markup = toPaisa(priced.markup_amount);
    const [entitlement, house] = allocate(markup, [50, 50]);

    expect(toAmount(entitlement)).toBe('50000.00');
    expect(toAmount(house)).toBe('50000.00');
    expect(entitlement + house).toBe(markup);
  });
});
