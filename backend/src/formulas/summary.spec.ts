import { toPaisa } from './money';
import {
  scoreDeal,
  summariseClient,
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

describe('totalPortfolio (BR-25, replacing BR-10)', () => {
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

  it('reads an unfunded portfolio as wholly the house, which is BR-10', () => {
    const totals = totalPortfolio(deals, toPaisa(1_000_000), toPaisa(50_000));

    expect(totals.house_outstanding).toBe(totals.total_outstanding);
    expect(totals.house_unmatured_profit).toBe(totals.unmatured_profit);
  });

  it('nets the investors out of the outstanding balance', () => {
    // Deal two is half funded; deal one is not funded at all.
    const totals = totalPortfolio(deals, 0, 0, [
      { investor_share_pct: 0, investor_entitlement: 0 },
      { investor_share_pct: 50, investor_entitlement: toPaisa(25_000) },
    ]);

    // The customer still owes 400,000 and the register still says so...
    expect(totals.total_outstanding).toBe('400000.00');
    // ...but half of it is owed onward to the investor.
    expect(totals.house_outstanding).toBe('200000.00');
  });

  it('keeps only the markup the investors are not entitled to', () => {
    const totals = totalPortfolio(deals, 0, 0, [
      { investor_share_pct: 0, investor_entitlement: 0 },
      { investor_share_pct: 50, investor_entitlement: toPaisa(25_000) },
    ]);

    // 100,000 markup less the investor's 25,000, none of it matured.
    expect(totals.unmatured_profit).toBe('100000.00');
    expect(totals.house_unmatured_profit).toBe('75000.00');
  });

  it('nets the balance on the house figures, not the portfolio ones', () => {
    const totals = totalPortfolio(deals, toPaisa(1_000_000), toPaisa(50_000), [
      { investor_share_pct: 0, investor_entitlement: 0 },
      { investor_share_pct: 50, investor_entitlement: toPaisa(25_000) },
    ]);

    // 1,000,000 + 75,000 - 50,000 - 200,000. BR-10 would have said 650,000,
    // which credits the business with money it has to hand back.
    expect(totals.net_balance).toBe('825000.00');
  });

  it('leaves the house nothing on a wholly investor-funded deal', () => {
    const totals = totalPortfolio(deals, 0, 0, [
      { investor_share_pct: 0, investor_entitlement: 0 },
      { investor_share_pct: 100, investor_entitlement: toPaisa(100_000) },
    ]);

    expect(totals.house_outstanding).toBe('0.00');
    expect(totals.house_unmatured_profit).toBe('0.00');
  });

  it('does not credit the house for an over-funded row', () => {
    const totals = totalPortfolio(deals, 0, 0, [
      { investor_share_pct: 0, investor_entitlement: 0 },
      // FR-CON-13 rejects this, but a bad row must not turn the house's
      // share negative and add to the balance.
      { investor_share_pct: 150, investor_entitlement: toPaisa(200_000) },
    ]);

    expect(totals.house_outstanding).toBe('0.00');
    expect(totals.house_unmatured_profit).toBe('0.00');
  });
});

describe('summariseClient (FR-SUM-07)', () => {
  const deal = (paid: number, sale = 500_000, markup = 100_000) => {
    const summary = summariseDeal({
      sale_price: sale,
      markup_amount: markup,
      down_payment: 100_000,
      paid: toPaisa(paid),
    });

    return { ...summary, ...scoreDeal(summary, toPaisa(paid)) };
  };

  it('passes a single deal through unchanged', () => {
    const one = deal(500_000);
    const client = summariseClient([one]);

    expect(client.deals).toBe(1);
    expect(client.score).toBe(one.score);
    expect(client.band).toBe(one.band);
  });

  it('sums the money across a client’s deals', () => {
    const client = summariseClient([deal(500_000), deal(100_000)]);

    expect(client.deals).toBe(2);
    expect(client.completed).toBe(1);
    expect(client.total_paid).toBe('600000.00');
    expect(client.total_outstanding).toBe('400000.00');
  });

  it('weights the score by deal value, not flat', () => {
    // A small plan paid perfectly beside a large one barely touched. A flat
    // average would flatter this client; the weighting must not.
    const small = deal(12_000, 10_000, 2_000);
    const large = deal(0, 1_000_000, 200_000);

    const flat = (Number(small.score) + Number(large.score)) / 2;
    const client = summariseClient([small, large]);

    expect(Number(client.score)).toBeLessThan(flat);
  });

  it('falls back to a flat average rather than dividing by zero', () => {
    const free = deal(0, 0, 0);

    expect(() => summariseClient([free])).not.toThrow();
    expect(summariseClient([free]).total_sale).toBe('0.00');
  });
});
