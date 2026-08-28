import { allocate, toAmount, toPaisa, type Paisa } from './money';

/**
 * BR-21 to BR-26: an investor's money.
 *
 * The governing idea is that **nothing is stored**. An investor's balance is
 * not a column that deposits increment and withdrawals decrement — it is a
 * reading over their transactions, their deployments and what those have
 * recovered. A stored balance is a number that can be wrong; a derived one
 * cannot disagree with the rows it comes from.
 *
 * Money is in paisa throughout; only the response mappers convert to strings.
 */

/** BR-21. Which half of an investor's money a line touches. */
export type Bucket = 'principal' | 'profit';

export type TxnType = 'Deposit' | 'Withdrawal' | 'Adjustment' | 'Loss';

/** A hand-entered or system-generated line on the investor ledger. */
export type InvestorTxn = {
  type: TxnType;
  bucket: Bucket;
  /** Signed for an Adjustment; positive for everything else. */
  amount: Paisa;
};

/**
 * BR-21's deployment and recovery terms. Zero in pass one, because funding is
 * not yet written; the shape is here so the reading does not change when it is.
 */
export type DeploymentTerms = {
  funded_from_principal: Paisa;
  funded_from_profit: Paisa;
  recovered_to_principal: Paisa;
  recovered_to_profit: Paisa;
  matured_profit: Paisa;
};

export const NO_DEPLOYMENTS: DeploymentTerms = {
  funded_from_principal: 0,
  funded_from_profit: 0,
  recovered_to_principal: 0,
  recovered_to_profit: 0,
  matured_profit: 0,
};

export type BucketBalances = {
  /** BR-24. Deposits less withdrawals, adjustments and losses. */
  net_principal: Paisa;
  principal_available: Paisa;
  principal_deployed: Paisa;
  /** BR-24. Every rupee of profit ever matured to this investor. */
  lifetime_profit: Paisa;
  profit_available: Paisa;
  profit_deployed: Paisa;
  /** What could be deployed or withdrawn right now, both buckets. */
  available: Paisa;
  deployed: Paisa;
  /** What the business owes this investor if everything stopped today. */
  payable: Paisa;
};

function sum(
  txns: InvestorTxn[],
  predicate: (txn: InvestorTxn) => boolean,
): Paisa {
  return txns.reduce(
    (total, txn) => (predicate(txn) ? total + txn.amount : total),
    0,
  );
}

/**
 * BR-21. Both buckets, derived.
 *
 * An Adjustment carries its own sign — that is how FR-IVT-08 corrects a
 * mis-entered line without editing the original — so it is added rather than
 * subtracted whichever way it points.
 */
export function bucketBalances(
  txns: InvestorTxn[],
  deployments: DeploymentTerms = NO_DEPLOYMENTS,
): BucketBalances {
  const inBucket = (bucket: Bucket) => (txn: InvestorTxn) =>
    txn.bucket === bucket;

  const deposits = sum(txns, (txn) => txn.type === 'Deposit');

  const withdrawn = (bucket: Bucket) =>
    sum(txns, (txn) => txn.type === 'Withdrawal' && inBucket(bucket)(txn));

  const adjusted = (bucket: Bucket) =>
    sum(txns, (txn) => txn.type === 'Adjustment' && inBucket(bucket)(txn));

  const lost = (bucket: Bucket) =>
    sum(txns, (txn) => txn.type === 'Loss' && inBucket(bucket)(txn));

  const net_principal =
    deposits -
    withdrawn('principal') +
    adjusted('principal') -
    lost('principal');

  const lifetime_profit = deployments.matured_profit;

  const principal_available =
    net_principal -
    deployments.funded_from_principal +
    deployments.recovered_to_principal;

  const profit_available =
    lifetime_profit -
    withdrawn('profit') +
    adjusted('profit') -
    lost('profit') -
    deployments.funded_from_profit +
    deployments.recovered_to_profit;

  const principal_deployed = Math.max(
    0,
    deployments.funded_from_principal - deployments.recovered_to_principal,
  );

  const profit_deployed = Math.max(
    0,
    deployments.funded_from_profit - deployments.recovered_to_profit,
  );

  const available = principal_available + profit_available;
  const deployed = principal_deployed + profit_deployed;

  return {
    net_principal,
    principal_available,
    principal_deployed,
    lifetime_profit,
    profit_available,
    profit_deployed,
    available,
    deployed,
    // Idle money plus money still out working: what is owed if the business
    // wound up today and every deployment came back whole.
    payable: available + deployed,
  };
}

/** BR-22. Which bucket a new deployment draws from, and in what order. */
export type DeploymentSource = 'profit_first' | 'principal_first' | 'pro_rata';

export type DeploymentSplit = {
  from_principal: Paisa;
  from_profit: Paisa;
};

/**
 * BR-22. Splitting a deployment across the two buckets.
 *
 * `profit_first` is the default because it keeps the investor's original
 * principal liquid: profit is the part they are least likely to ask for back
 * at short notice, so it is the part to put to work first.
 *
 * A deployment equal to the whole balance draws from both regardless — there
 * is no ordering question when everything goes.
 */
export function splitDeployment(
  amount: Paisa,
  principalAvailable: Paisa,
  profitAvailable: Paisa,
  source: DeploymentSource = 'profit_first',
): DeploymentSplit {
  const total = principalAvailable + profitAvailable;

  if (amount > total) {
    throw new Error(
      `deployment of ${toAmount(amount)} exceeds the available ${toAmount(total)}`,
    );
  }

  if (amount === total) {
    return { from_principal: principalAvailable, from_profit: profitAvailable };
  }

  if (source === 'pro_rata') {
    // BR-26: the residual goes to the larger share, so the two parts sum to
    // the deployment exactly rather than to a rupee either side of it.
    const [from_principal, from_profit] = allocate(amount, [
      principalAvailable,
      profitAvailable,
    ]);

    return { from_principal, from_profit };
  }

  const first =
    source === 'profit_first' ? profitAvailable : principalAvailable;
  const fromFirst = Math.min(amount, first);
  const fromSecond = amount - fromFirst;

  return source === 'profit_first'
    ? { from_principal: fromSecond, from_profit: fromFirst }
    : { from_principal: fromFirst, from_profit: fromSecond };
}

export type LifetimeMetrics = {
  /** BR-24. Profit as a percentage of the money the investor actually put in. */
  return_on_principal: string;
  /** BR-24. How many times over their principal has been put to work. */
  capital_turnover: string;
  /** BR-24a. How far their original money has grown, wherever it now sits. */
  cumulative_growth: string;
};

function pct(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * BR-24 and BR-24a.
 *
 * All three divide by net principal, so an investor who has withdrawn
 * everything — or never deposited — would divide by zero. That reads as 0.00
 * rather than infinity: no principal at risk means no return to report, which
 * is the honest answer and not a defect being hidden.
 */
export function lifetimeMetrics(
  balances: BucketBalances,
  totalDeployed: Paisa,
): LifetimeMetrics {
  const base = balances.net_principal;

  if (base <= 0) {
    return {
      return_on_principal: '0.00',
      capital_turnover: '0.00',
      cumulative_growth: '0.00',
    };
  }

  return {
    return_on_principal: pct((balances.lifetime_profit / base) * 100),
    capital_turnover: pct(totalDeployed / base),
    cumulative_growth: pct(((balances.payable - base) / base) * 100),
  };
}

/** BR-24a. What one deployment returned, as a percentage of itself. */
export function cycleGrowth(
  maturedProfit: Paisa,
  fundingAmount: Paisa,
): string {
  return fundingAmount === 0
    ? '0.00'
    : pct((maturedProfit / fundingAmount) * 100);
}

/**
 * BR-15. An investor's share of a contract, fixed at activation.
 * Capital required is the **cost price**, not the sale price (BR-14).
 */
export function fundingShare(
  fundingAmount: Paisa,
  costPrice: string | number,
): string {
  const cost = toPaisa(costPrice);

  return cost === 0 ? '0.00' : pct((fundingAmount / cost) * 100);
}

/**
 * BR-17. What one investor is owed from a contract's markup.
 *
 * Two percentages multiply: how much of the deal they funded, and what share
 * of the profit on their part they take. The house keeps the remainder of the
 * markup and the whole of the retail margin (BR-14).
 */
export function profitEntitlement(
  markupAmount: string | number,
  sharePct: string | number,
  profitSharePct: string | number,
): Paisa {
  const markup = toPaisa(markupAmount);

  return Math.round(
    (markup * Number(sharePct) * Number(profitSharePct)) / 10_000,
  );
}

/** One investor's stake in a contract, as `contract_fundings` stores it. */
export type FundingRow = {
  investor_id: number;
  amount: Paisa;
  /** BR-15. Of the contract's cost price. */
  share_pct: string | number;
  /** BR-16. Fixed when the row was written; may differ per investor. */
  profit_share_pct: string | number;
  funded_from_principal: Paisa;
  funded_from_profit: Paisa;
};

export type RecoveryShare = {
  investor_id: number;
  /** BR-18. This investor's slice of everything the contract has returned. */
  slice: Paisa;
  capital_recovered: Paisa;
  matured_profit: Paisa;
  unmatured_profit: Paisa;
  entitlement: Paisa;
  /** BR-19. Where `capital_recovered` goes back to. */
  recovered_to_principal: Paisa;
  recovered_to_profit: Paisa;
};

export type ContractRecovery = {
  /** BR-18. Down payment plus non-voided payments — not the contract balance. */
  recovered: Paisa;
  shares: RecoveryShare[];
  /** What is left for the house after every entitlement is met. */
  house_surplus: Paisa;
};

/**
 * BR-18 and BR-19. How a contract's money comes back to the people who funded
 * it.
 *
 * Two things about the stream are easy to get wrong. It includes the **down
 * payment**, which is not a payment row and never touches the contract balance
 * — the customer handed that over at signing and it is real recovery. And
 * **capital is always repaid before any profit exists**: an investor sees
 * nothing but their own money back until the whole of their stake has
 * returned, however long the plan runs.
 *
 * Slices are rounded per BR-26 with the residual to the largest, so the parts
 * never sum to a rupee either side of the whole.
 */
export function splitRecovery(
  terms: {
    down_payment: string | number;
    paid: Paisa;
    markup_amount: string | number;
  },
  fundings: FundingRow[],
): ContractRecovery {
  const recovered = toPaisa(terms.down_payment) + terms.paid;

  if (fundings.length === 0) {
    return { recovered, shares: [], house_surplus: recovered };
  }

  // The slices are a pro-rata split of the recovered stream by share, so they
  // go through `allocate` rather than being rounded one at a time.
  const slices = allocate(
    Math.min(
      recovered,
      // A slice cannot exceed the share of the stream the investors hold
      // between them; the rest is the house's from the start.
      Math.round(
        (recovered *
          fundings.reduce(
            (total, funding) => total + Number(funding.share_pct),
            0,
          )) /
          100,
      ),
    ),
    fundings.map((funding) => Number(funding.share_pct)),
  );

  let houseSurplus = recovered;

  const shares = fundings.map((funding, index) => {
    const slice = slices[index];
    const entitlement = profitEntitlement(
      terms.markup_amount,
      funding.share_pct,
      funding.profit_share_pct,
    );

    const capital_recovered = Math.min(slice, funding.amount);
    const surplus = Math.max(0, slice - funding.amount);
    const matured_profit = Math.min(surplus, entitlement);

    // BR-19: capital goes home the way it came. A funding row is never zero on
    // both sides, so the ratio is always defined.
    const funded = funding.funded_from_principal + funding.funded_from_profit;

    const [recovered_to_principal, recovered_to_profit] =
      funded === 0
        ? [capital_recovered, 0]
        : allocate(capital_recovered, [
            funding.funded_from_principal,
            funding.funded_from_profit,
          ]);

    houseSurplus -= capital_recovered + matured_profit;

    return {
      investor_id: funding.investor_id,
      slice,
      capital_recovered,
      matured_profit,
      unmatured_profit: entitlement - matured_profit,
      entitlement,
      recovered_to_principal,
      recovered_to_profit,
    };
  });

  return { recovered, shares, house_surplus: Math.max(0, houseSurplus) };
}

/** BR-14. What the business itself put into a contract. */
export function houseFunded(
  costPrice: string | number,
  fundings: FundingRow[],
): Paisa {
  return Math.max(
    0,
    toPaisa(costPrice) -
      fundings.reduce((total, funding) => total + funding.amount, 0),
  );
}
