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
  /** BR-10. Capital and expenses come from the persisted entries. */
  net_balance: string;
};

/**
 * BR-10. `netBalance = capital + unmaturedProfit − expenses − totalOutstanding`.
 *
 * Unmatured profit is added rather than mature: mature profit has already
 * arrived as cash and is inside the capital figure, so counting it again would
 * double it. What the balance is asking is what the business is worth once
 * everything still owed has been collected.
 */
export function totalPortfolio(
  deals: DealSummary[],
  capital: Paisa,
  expenses: Paisa,
): PortfolioTotals {
  const sum = (pick: (deal: DealSummary) => string): Paisa =>
    deals.reduce((total, deal) => total + toPaisa(pick(deal)), 0);

  const outstanding = sum((deal) => deal.outstanding);
  const mature = sum((deal) => deal.mature_profit);
  const unmatured = sum((deal) => deal.unmatured_profit);

  const completed = deals.filter((deal) => deal.matured).length;

  const markupPcts = deals.map((deal) => Number(deal.actual_markup_pct));

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
    net_balance: toAmount(capital + unmatured - expenses - outstanding),
  };
}
