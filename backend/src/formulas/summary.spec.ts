import { toPaisa } from './money';
import {
  scoreDeal,
  summariseDeal,
  totalPortfolio,
  type DealSummary,
} from './summary';

/** The §O worked deal: sale 500,000, markup 100,000, down 100,000. */
const TERMS = {
  sale_price: 500_000,
  markup_amount: 100_000,
  down_payment: 100_000,
};

describe('summariseDeal (BR-08)', () => {
  it('derives the v1 column set from the stored terms', () => {
    const deal = summariseDeal({ ...TERMS, paid: 0 });

    expect(deal.total_sale).toBe('600000.00');
    expect(deal.rem_balance).toBe('500000.00');
    expect(deal.investment).toBe('400000.00');
    expect(deal.actual_markup_pct).toBe('20.00');
    expect(deal.outstanding).toBe('500000.00');
    expect(deal.pct_completed).toBe('0.00');
    expect(deal.matured).toBe(false);
  });

  it('agrees with the contract module: rem_balance is the financed amount', () => {
    const deal = summariseDeal({ ...TERMS, paid: 0 });

    // financed = net - down = 600,000 - 100,000. The summary must not invent
    // its own basis, which is exactly what went wrong in v1 §9.3.
    expect(deal.rem_balance).toBe('500000.00');
  });

  it('tracks completion against the financed amount', () => {
    const half = summariseDeal({ ...TERMS, paid: toPaisa(250_000) });

    expect(half.pct_completed).toBe('50.00');
    expect(half.outstanding).toBe('250000.00');
    expect(half.matured).toBe(false);
  });

  it('matures once the financed amount is covered', () => {
    const done = summariseDeal({ ...TERMS, paid: toPaisa(500_000) });

    expect(done.pct_completed).toBe('100.00');
    expect(done.outstanding).toBe('0.00');
    expect(done.matured).toBe(true);
    expect(done.mature_profit).toBe('100000.00');
    expect(done.unmatured_profit).toBe('0.00');
  });

  it('caps completion at 100 rather than reporting an overpaid deal above it', () => {
    const over = summariseDeal({ ...TERMS, paid: toPaisa(520_000) });

    expect(over.pct_completed).toBe('100.00');
    expect(over.outstanding).toBe('0.00');
  });

  it('reports the markup actually written, not the one intended', () => {
    const odd = summariseDeal({
      sale_price: 45_000,
      markup_amount: 9_000,
      down_payment: 0,
      paid: 0,
    });

    expect(odd.actual_markup_pct).toBe('20.00');
  });

  it('treats a fully pre-paid deal as complete rather than dividing by zero', () => {
    const prepaid = summariseDeal({
      sale_price: 10_000,
      markup_amount: 0,
      down_payment: 10_000,
      paid: 0,
    });

    expect(prepaid.rem_balance).toBe('0.00');
    expect(prepaid.pct_completed).toBe('100.00');
    expect(prepaid.matured).toBe(true);
  });
});

describe('scoreDeal (BR-11)', () => {
  it('weights completion, capital recovery and markup 55/30/15', () => {
    const deal = summariseDeal({ ...TERMS, paid: toPaisa(500_000) });
    const score = scoreDeal(deal, toPaisa(500_000));

    // 0.55*100 + 0.30*100 + 0.15*20 = 88
    expect(score.pct_completed).toBe('100.00');
    expect(score.capital_recovery).toBe('100.00');
    expect(score.markup_component).toBe('20.00');
    expect(score.score).toBe('88.00');
    expect(score.band).toBe('green');
  });

  it('measures capital recovery against the investment, not the plan', () => {
    // 400,000 paid on a 400,000 investment: the money is back even though the
    // plan is only 80% collected.
    const deal = summariseDeal({ ...TERMS, paid: toPaisa(400_000) });
    const score = scoreDeal(deal, toPaisa(400_000));

    expect(score.pct_completed).toBe('80.00');
    expect(score.capital_recovery).toBe('100.00');
  });

  it('bands at 75 and 45', () => {
    const nothing = summariseDeal({ ...TERMS, paid: 0 });

    // 0.55*0 + 0.30*0 + 0.15*20 = 3
    expect(scoreDeal(nothing, 0).band).toBe('red');

    const partial = summariseDeal({ ...TERMS, paid: toPaisa(250_000) });

    // 0.55*50 + 0.30*62.5 + 0.15*20 = 49.25
    expect(scoreDeal(partial, toPaisa(250_000)).band).toBe('gold');
  });
});

describe('totalPortfolio (BR-10)', () => {
  const deals: DealSummary[] = [
    summariseDeal({ ...TERMS, paid: toPaisa(500_000) }),
    summariseDeal({ ...TERMS, paid: toPaisa(100_000) }),
  ];

  it('counts completed against in progress', () => {
    const totals = totalPortfolio(deals, 0, 0);

    expect(totals.deals).toBe(2);
    expect(totals.completed).toBe(1);
    expect(totals.in_progress).toBe(1);
  });

  it('sums the money columns and averages the markup', () => {
    const totals = totalPortfolio(deals, 0, 0);

    expect(totals.total_sale).toBe('1200000.00');
    expect(totals.total_outstanding).toBe('400000.00');
    expect(totals.total_paid).toBe('600000.00');
    expect(totals.average_markup_pct).toBe('20.00');
  });

  it('splits profit into what has been earned and what has not', () => {
    const totals = totalPortfolio(deals, 0, 0);

    // Deal one matured its whole markup; deal two has recovered none of its
    // 400,000 investment yet, so none of its markup has been earned.
    expect(totals.mature_profit).toBe('100000.00');
    expect(totals.unmatured_profit).toBe('100000.00');
    expect(totals.total_profit).toBe('200000.00');
  });

  it('nets capital and unmatured profit against expenses and outstanding', () => {
    const totals = totalPortfolio(deals, toPaisa(1_000_000), toPaisa(50_000));

    // 1,000,000 + 100,000 - 50,000 - 400,000
    expect(totals.net_balance).toBe('650000.00');
  });

  it('reports zeroes rather than dividing by nothing on an empty portfolio', () => {
    const totals = totalPortfolio([], 0, 0);

    expect(totals.deals).toBe(0);
    expect(totals.average_markup_pct).toBe('0.00');
    expect(totals.net_balance).toBe('0.00');
  });
});
