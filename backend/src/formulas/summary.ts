import { matureProfit } from './ledger';
import { toAmount, toPaisa, type Paisa } from './money';

/**
 * BR-08, BR-10 and BR-11: the Summary Report's arithmetic.
 *
 * Carried over from v1 verbatim, which is the point — the owner reads these
 * columns the same way they always have. What changed is where they are
 * computed: v1 derived them in the browser from a hand-maintained workbook,
 * so two screens could disagree about the same deal (§9.6). Here they are one
 * pure function over the stored terms and the payments total.
 */

export type DealTerms = {
  sale_price: string | number;
  markup_amount: string | number;
  down_payment: string | number;
  /** Non-voided payment total, in paisa. */
  paid: Paisa;
};

export type DealSummary = {
  markup_amount: string;
  /** Sale plus markup — what the customer owes in total. */
  total_sale: string;
  /** Total less the down payment: the amount financed. */
  rem_balance: string;
  /** What the business has out on this deal. */
  investment: string;
  /** The markup as a percentage of the sale price, as actually written. */
  actual_markup_pct: string;
  paid: string;
  outstanding: string;
  /** Capped at 100; a deal cannot be more than finished. */
  pct_completed: string;
  mature_profit: string;
  unmatured_profit: string;
  /** BR-08: at 100%, or once paid covers the financed amount. */
  matured: boolean;
};

/** Two decimals, as a percentage is stored and shown throughout. */
function pct(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** BR-08, per deal. */
export function summariseDeal(terms: DealTerms): DealSummary {
  const sale = toPaisa(terms.sale_price);
  const markup = toPaisa(terms.markup_amount);
  const down = toPaisa(terms.down_payment);
  const paid = terms.paid;

  const totalSale = sale + markup;
  const remBalance = Math.max(0, totalSale - down);
  const investment = Math.max(0, sale - down);

  const profit = matureProfit({
    sale_price: terms.sale_price,
    down_payment: terms.down_payment,
    markup_amount: terms.markup_amount,
    paid,
  });

  return {
    markup_amount: toAmount(markup),
    total_sale: toAmount(totalSale),
    rem_balance: toAmount(remBalance),
    investment: toAmount(investment),
    actual_markup_pct: sale === 0 ? '0.00' : pct((markup / sale) * 100),
    paid: toAmount(paid),
    outstanding: toAmount(Math.max(0, remBalance - paid)),
    // A plan with nothing to finance is complete by definition, not divided by
    // zero — that is how a fully pre-paid deal reads.
    pct_completed:
      remBalance === 0
        ? '100.00'
        : pct(Math.min(100, (paid / remBalance) * 100)),
    mature_profit: toAmount(profit.mature),
    unmatured_profit: toAmount(profit.unmatured),
    matured: remBalance === 0 || paid >= remBalance,
  };
}

export type ScoreBand = 'green' | 'gold' | 'red';

export type DealScore = {
  /** 0 to 100. */
  score: string;
  band: ScoreBand;
  /** The three inputs, so a screen can show why the score is what it is. */
  pct_completed: string;
  capital_recovery: string;
  markup_component: string;
};

/**
 * BR-11. Three parts: how much of the plan is collected, how much of the
 * money the business put in has come back, and how well the deal was priced.
 *
 * Capital recovery is measured against `investment`, not the financed amount:
 * it answers "have we got our own money back", which is a different question
 * from "is the plan finished".
 */
export function scoreDeal(summary: DealSummary, paid: Paisa): DealScore {
  const investment = toPaisa(summary.investment);

  const completed = Number(summary.pct_completed);
  const recovery =
    investment === 0 ? 100 : Math.min(100, (paid / investment) * 100);
  const markup = Math.min(100, Number(summary.actual_markup_pct));

  const score = 0.55 * completed + 0.3 * recovery + 0.15 * markup;

  return {
    score: pct(score),
    band: score >= 75 ? 'green' : score >= 45 ? 'gold' : 'red',
    pct_completed: pct(completed),
    capital_recovery: pct(recovery),
    markup_component: pct(markup),
  };
}

export type PortfolioTotals = {
  deals: number;
  completed: number;
  in_progress: number;
  total_sale: string;
  total_outstanding: string;
  total_paid: string;
  mature_profit: string;
  unmatured_profit: string;
  total_profit: string;
  average_markup_pct: string;
  /** BR-25. Outstanding net of what the investors are owed out of it. */
  house_outstanding: string;
  /** BR-25. Unmatured profit the house itself stands to keep. */
  house_unmatured_profit: string;
  /**
   * BR-25 (replacing BR-10). Own capital and expenses from the persisted
   * entries; investor money never appears here (FR-SUM-10).
   */
  net_balance: string;
};

/**
 * BR-25. One deal's investor participation, as the portfolio reads it.
 *
 * Both figures are sums across that contract's funders: the shares they hold
 * of its cost, and the profit they are entitled to out of its markup.
 */
export type HouseShare = {
  /** Σ `share_pct` across the funders, 0 to 100. */
  investor_share_pct: number;
  /** Σ entitlement per BR-17, in paisa. */
  investor_entitlement: Paisa;
};

const WHOLLY_HOUSE: HouseShare = {
  investor_share_pct: 0,
  investor_entitlement: 0,
};

/**
 * BR-25, which replaces BR-10.
 *
 * `netBalance = ownCapital + houseUnmaturedProfit − expenses − houseOutstanding`
 *
 * The difference from BR-10 is whose money is being counted. A contract funded
 * by investors still shows its whole outstanding balance in the register — the
 * customer owes all of it — but the business does not stand to keep all of it,
 * and it did not put all of it in. Netting out the investors' participation is
 * what makes this figure the *house's* position rather than the portfolio's.
 *
 * Unmatured profit is added rather than mature: mature profit has already
 * arrived as cash and is inside the capital figure, so counting it again would
 * double it. What the balance asks is what the business is worth once
 * everything still owed has been collected.
 *
 * BR-25 also adds `unmaturedRetailMargin`, the part of the sale price above
 * cost. This build has no such margin to add: one purchase price replaced the
 * cost/sale pair (SRS §2.7 item 15), so sale equals cost and the term is
 * structurally zero rather than merely unimplemented.
 */
export function totalPortfolio(
  deals: DealSummary[],
  capital: Paisa,
  expenses: Paisa,
  /**
   * BR-25. Investor participation, index-aligned with `deals`. A deal with no
   * entry is wholly house-funded, which is the common case and the default.
   */
  participation: HouseShare[] = [],
): PortfolioTotals {
  const sum = (pick: (deal: DealSummary) => string): Paisa =>
    deals.reduce((total, deal) => total + toPaisa(pick(deal)), 0);

  const outstanding = sum((deal) => deal.outstanding);
  const mature = sum((deal) => deal.mature_profit);
  const unmatured = sum((deal) => deal.unmatured_profit);

  const completed = deals.filter((deal) => deal.matured).length;

  const markupPcts = deals.map((deal) => Number(deal.actual_markup_pct));

  let houseOutstanding = 0;
  let houseUnmatured = 0;

  deals.forEach((deal, index) => {
    const share = participation[index] ?? WHOLLY_HOUSE;

    // A funded contract cannot be more than fully funded (FR-CON-13 rejects
    // it), but clamping means a bad row cannot turn the house's share
    // negative and quietly credit the business for someone else's money.
    const houseFraction = Math.max(
      0,
      1 - Math.min(100, share.investor_share_pct) / 100,
    );

    houseOutstanding += Math.round(toPaisa(deal.outstanding) * houseFraction);

    const markup = toPaisa(deal.markup_amount);

    if (markup === 0) return;

    // The house's slice of the markup, times the part of it still to mature.
    // Taking the fraction rather than the rupees keeps this consistent with
    // BR-09: profit matures with the deal, not with each payment.
    const houseMarkup = Math.max(0, markup - share.investor_entitlement);
    const unmaturedFraction = toPaisa(deal.unmatured_profit) / markup;

    houseUnmatured += Math.round(houseMarkup * unmaturedFraction);
  });

  return {
    deals: deals.length,
    completed,
    in_progress: deals.length - completed,
    total_sale: toAmount(sum((deal) => deal.total_sale)),
    total_outstanding: toAmount(outstanding),
    total_paid: toAmount(sum((deal) => deal.paid)),
    mature_profit: toAmount(mature),
    unmatured_profit: toAmount(unmatured),
    total_profit: toAmount(mature + unmatured),
    average_markup_pct:
      markupPcts.length === 0
        ? '0.00'
        : pct(
            markupPcts.reduce((total, value) => total + value, 0) /
              markupPcts.length,
          ),
    house_outstanding: toAmount(houseOutstanding),
    house_unmatured_profit: toAmount(houseUnmatured),
    net_balance: toAmount(
      capital + houseUnmatured - expenses - houseOutstanding,
    ),
  };
}

export type ClientDeal = DealSummary & DealScore;

export type ClientSummary = {
  deals: number;
  completed: number;
  total_sale: string;
  total_paid: string;
  total_outstanding: string;
  mature_profit: string;
  unmatured_profit: string;
  /**
   * FR-SUM-07. One score for a client who may hold several deals.
   *
   * Weighted by each deal's written value rather than averaged flat: a
   * customer who pays a small plan perfectly and lets a large one run late has
   * not behaved as well as a flat average would suggest, and this ranking is
   * meant to say who is worth writing more business with.
   *
   * With one deal the weighting is a no-op, which is the common case.
   */
  score: string;
  band: ScoreBand;
};

export function summariseClient(deals: ClientDeal[]): ClientSummary {
  const sum = (pick: (deal: ClientDeal) => string): Paisa =>
    deals.reduce((total, deal) => total + toPaisa(pick(deal)), 0);

  const weight = sum((deal) => deal.total_sale);

  const weighted =
    weight === 0
      ? // Every deal written at zero value: a flat average rather than a
        // division by nothing.
        deals.reduce((total, deal) => total + Number(deal.score), 0) /
        Math.max(1, deals.length)
      : deals.reduce(
          (total, deal) =>
            total + Number(deal.score) * toPaisa(deal.total_sale),
          0,
        ) / weight;

  return {
    deals: deals.length,
    completed: deals.filter((deal) => deal.matured).length,
    total_sale: toAmount(weight),
    total_paid: toAmount(sum((deal) => deal.paid)),
    total_outstanding: toAmount(sum((deal) => deal.outstanding)),
    mature_profit: toAmount(sum((deal) => deal.mature_profit)),
    unmatured_profit: toAmount(sum((deal) => deal.unmatured_profit)),
    score: pct(weighted),
    band: weighted >= 75 ? 'green' : weighted >= 45 ? 'gold' : 'red',
  };
}
