import {
  bucketBalances,
  cycleGrowth,
  fundingShare,
  houseFunded,
  lifetimeMetrics,
  profitEntitlement,
  splitDeployment,
  allocateLoss,
  splitRecovery,
  type InvestorTxn,
} from './investor';
import { toPaisa } from './money';

const deposit = (amount: number): InvestorTxn => ({
  type: 'Deposit',
  bucket: 'principal',
  amount: toPaisa(amount),
});

const withdrawal = (
  amount: number,
  bucket: 'principal' | 'profit',
): InvestorTxn => ({ type: 'Withdrawal', bucket, amount: toPaisa(amount) });

const adjustment = (
  amount: number,
  bucket: 'principal' | 'profit',
): InvestorTxn => ({ type: 'Adjustment', bucket, amount: toPaisa(amount) });

describe('bucketBalances (BR-21)', () => {
  it('reads an empty ledger as zero, not as undefined', () => {
    const balances = bucketBalances([]);

    expect(balances.net_principal).toBe(0);
    expect(balances.available).toBe(0);
    expect(balances.payable).toBe(0);
  });

  it('credits a deposit to principal', () => {
    const balances = bucketBalances([deposit(1_000_000)]);

    expect(balances.net_principal).toBe(toPaisa(1_000_000));
    expect(balances.principal_available).toBe(toPaisa(1_000_000));
    expect(balances.profit_available).toBe(0);
    expect(balances.payable).toBe(toPaisa(1_000_000));
  });

  it('takes a withdrawal from the bucket it names', () => {
    const balances = bucketBalances([
      deposit(1_000_000),
      withdrawal(200_000, 'principal'),
    ]);

    expect(balances.net_principal).toBe(toPaisa(800_000));
    expect(balances.principal_available).toBe(toPaisa(800_000));
  });

  it('lets a signed adjustment correct a line in either direction', () => {
    // FR-IVT-08: a mis-entered deposit of 100,000 too much is reversed, not
    // edited away.
    const balances = bucketBalances([
      deposit(1_100_000),
      adjustment(-100_000, 'principal'),
    ]);

    expect(balances.net_principal).toBe(toPaisa(1_000_000));

    const upward = bucketBalances([
      deposit(900_000),
      adjustment(100_000, 'principal'),
    ]);

    expect(upward.net_principal).toBe(toPaisa(1_000_000));
  });

  it('separates money deployed from money idle', () => {
    const balances = bucketBalances([deposit(1_000_000)], {
      funded_from_principal: toPaisa(400_000),
      funded_from_profit: 0,
      recovered_to_principal: toPaisa(150_000),
      recovered_to_profit: 0,
      matured_profit: toPaisa(30_000),
    });

    // 1,000,000 out 400,000, back 150,000.
    expect(balances.principal_available).toBe(toPaisa(750_000));
    expect(balances.principal_deployed).toBe(toPaisa(250_000));
    expect(balances.profit_available).toBe(toPaisa(30_000));
    expect(balances.available).toBe(toPaisa(780_000));
    expect(balances.payable).toBe(toPaisa(1_030_000));
  });

  it('counts matured profit as lifetime even after it is withdrawn', () => {
    const balances = bucketBalances(
      [deposit(500_000), withdrawal(20_000, 'profit')],
      {
        funded_from_principal: 0,
        funded_from_profit: 0,
        recovered_to_principal: 0,
        recovered_to_profit: 0,
        matured_profit: toPaisa(50_000),
      },
    );

    expect(balances.lifetime_profit).toBe(toPaisa(50_000));
    expect(balances.profit_available).toBe(toPaisa(30_000));
  });
});

describe('splitDeployment (BR-22)', () => {
  const principal = toPaisa(600_000);
  const profit = toPaisa(100_000);

  it('takes profit first by default, keeping principal liquid', () => {
    const split = splitDeployment(toPaisa(80_000), principal, profit);

    expect(split.from_profit).toBe(toPaisa(80_000));
    expect(split.from_principal).toBe(0);
  });

  it('spills into principal once profit runs out', () => {
    const split = splitDeployment(toPaisa(250_000), principal, profit);

    expect(split.from_profit).toBe(toPaisa(100_000));
    expect(split.from_principal).toBe(toPaisa(150_000));
  });

  it('honours principal_first when that is asked for', () => {
    const split = splitDeployment(
      toPaisa(250_000),
      principal,
      profit,
      'principal_first',
    );

    expect(split.from_principal).toBe(toPaisa(250_000));
    expect(split.from_profit).toBe(0);
  });

  it('splits pro rata with the residual on the larger share (BR-26)', () => {
    const split = splitDeployment(
      toPaisa(350_000),
      principal,
      profit,
      'pro_rata',
    );

    // The parts must sum to the deployment exactly, never to a rupee either
    // side of it.
    expect(split.from_principal + split.from_profit).toBe(toPaisa(350_000));
    expect(split.from_principal).toBeGreaterThan(split.from_profit);
  });

  it('draws from both when the whole balance goes, whatever the source', () => {
    for (const source of [
      'profit_first',
      'principal_first',
      'pro_rata',
    ] as const) {
      const split = splitDeployment(
        principal + profit,
        principal,
        profit,
        source,
      );

      expect(split.from_principal).toBe(principal);
      expect(split.from_profit).toBe(profit);
    }
  });

  it('refuses to deploy more than is available', () => {
    expect(() => splitDeployment(toPaisa(700_001), principal, profit)).toThrow(
      /exceeds the available/,
    );
  });
});

describe('lifetimeMetrics (BR-24, BR-24a)', () => {
  it('reports return, turnover and growth against net principal', () => {
    const balances = bucketBalances([deposit(1_000_000)], {
      funded_from_principal: toPaisa(400_000),
      funded_from_profit: 0,
      recovered_to_principal: toPaisa(400_000),
      recovered_to_profit: 0,
      matured_profit: toPaisa(100_000),
    });

    const metrics = lifetimeMetrics(balances, toPaisa(2_000_000));

    expect(metrics.return_on_principal).toBe('10.00');
    expect(metrics.capital_turnover).toBe('2.00');
    // payable 1,100,000 against 1,000,000 put in.
    expect(metrics.cumulative_growth).toBe('10.00');
  });

  it('reports zero rather than infinity when no principal is at risk', () => {
    const metrics = lifetimeMetrics(bucketBalances([]), toPaisa(500_000));

    expect(metrics.return_on_principal).toBe('0.00');
    expect(metrics.capital_turnover).toBe('0.00');
    expect(metrics.cumulative_growth).toBe('0.00');
  });
});

describe('per-deal rules', () => {
  it('measures the funding share against cost price, not sale (BR-14/BR-15)', () => {
    expect(fundingShare(toPaisa(200_000), 400_000)).toBe('50.00');
    expect(fundingShare(0, 400_000)).toBe('0.00');
    expect(fundingShare(toPaisa(1), 0)).toBe('0.00');
  });

  it('multiplies the two percentages for an entitlement (BR-17)', () => {
    // Half the deal, half the profit on it: a quarter of a 100,000 markup.
    expect(profitEntitlement(100_000, '50.00', '50.00')).toBe(toPaisa(25_000));
    expect(profitEntitlement(100_000, '100.00', '50.00')).toBe(toPaisa(50_000));
    expect(profitEntitlement(100_000, '0.00', '50.00')).toBe(0);
  });

  it('reports what one deployment returned (BR-24a)', () => {
    expect(cycleGrowth(toPaisa(20_000), toPaisa(200_000))).toBe('10.00');
    expect(cycleGrowth(toPaisa(5_000), 0)).toBe('0.00');
  });
});

describe('splitRecovery (BR-18, BR-19)', () => {
  /**
   * A 400,000 cost-price deal with a 100,000 markup, half funded by one
   * investor who takes half the profit on their half.
   */
  const TERMS = { down_payment: 100_000, markup_amount: 100_000 };

  const half = {
    investor_id: 1,
    amount: toPaisa(200_000),
    share_pct: '50.00',
    profit_share_pct: '50.00',
    funded_from_principal: toPaisa(200_000),
    funded_from_profit: 0,
  };

  it('counts the down payment as recovery, though it is not a payment row', () => {
    const result = splitRecovery({ ...TERMS, paid: 0 }, [half]);

    expect(result.recovered).toBe(toPaisa(100_000));
    // Half of 100,000 recovered so far.
    expect(result.shares[0].slice).toBe(toPaisa(50_000));
  });

  it('repays capital before any profit exists', () => {
    // Slice 150,000 against a 200,000 stake: still nothing but their own money.
    const result = splitRecovery({ ...TERMS, paid: toPaisa(200_000) }, [half]);

    expect(result.shares[0].slice).toBe(toPaisa(150_000));
    expect(result.shares[0].capital_recovered).toBe(toPaisa(150_000));
    expect(result.shares[0].matured_profit).toBe(0);
    expect(result.shares[0].entitlement).toBe(toPaisa(25_000));
    expect(result.shares[0].unmatured_profit).toBe(toPaisa(25_000));
  });

  it('starts maturing profit only once the whole stake is back', () => {
    // Slice 210,000: 200,000 is capital, the 10,000 above it is profit.
    const result = splitRecovery({ ...TERMS, paid: toPaisa(320_000) }, [half]);

    expect(result.shares[0].capital_recovered).toBe(toPaisa(200_000));
    expect(result.shares[0].matured_profit).toBe(toPaisa(10_000));
    expect(result.shares[0].unmatured_profit).toBe(toPaisa(15_000));
  });

  it('caps matured profit at the entitlement and gives the rest to the house', () => {
    const result = splitRecovery({ ...TERMS, paid: toPaisa(500_000) }, [half]);

    expect(result.shares[0].matured_profit).toBe(toPaisa(25_000));
    expect(result.shares[0].unmatured_profit).toBe(0);
    // 600,000 recovered, of which the investor took 225,000.
    expect(result.house_surplus).toBe(toPaisa(375_000));
  });

  it('returns capital to the buckets it came from (BR-19)', () => {
    const mixed = {
      ...half,
      funded_from_principal: toPaisa(150_000),
      funded_from_profit: toPaisa(50_000),
    };

    const result = splitRecovery({ ...TERMS, paid: toPaisa(300_000) }, [mixed]);
    const share = result.shares[0];

    // Funded 3:1, so recovery comes back 3:1.
    expect(share.capital_recovered).toBe(toPaisa(200_000));
    expect(share.recovered_to_principal).toBe(toPaisa(150_000));
    expect(share.recovered_to_profit).toBe(toPaisa(50_000));
  });

  it('splits between two investors with different profit shares', () => {
    const a = {
      ...half,
      investor_id: 1,
      share_pct: '25.00',
      amount: toPaisa(100_000),
    };
    const b = {
      ...half,
      investor_id: 2,
      share_pct: '25.00',
      profit_share_pct: '40.00',
      amount: toPaisa(100_000),
    };

    const result = splitRecovery({ ...TERMS, paid: toPaisa(500_000) }, [a, b]);

    // BR-16 allows two investors on one contract to hold different rates.
    expect(result.shares[0].entitlement).toBe(toPaisa(12_500));
    expect(result.shares[1].entitlement).toBe(toPaisa(10_000));
    // Equal shares of the stream.
    expect(result.shares[0].slice).toBe(result.shares[1].slice);
  });

  it('gives the whole stream to the house when nobody funded it', () => {
    const result = splitRecovery({ ...TERMS, paid: toPaisa(200_000) }, []);

    expect(result.shares).toHaveLength(0);
    expect(result.house_surplus).toBe(toPaisa(300_000));
  });

  it('never lets the slices exceed what the investors collectively hold', () => {
    const result = splitRecovery({ ...TERMS, paid: toPaisa(500_000) }, [half]);
    const claimed = result.shares.reduce((sum, share) => sum + share.slice, 0);

    // One investor on 50% cannot be sliced more than half the stream.
    expect(claimed).toBe(toPaisa(300_000));
  });
});

describe('houseFunded (BR-14)', () => {
  const funding = (amount: number) => ({
    investor_id: 1,
    amount: toPaisa(amount),
    share_pct: '50.00',
    profit_share_pct: '50.00',
    funded_from_principal: toPaisa(amount),
    funded_from_profit: 0,
  });

  it('is the cost price less what investors put up', () => {
    expect(houseFunded(400_000, [funding(200_000)])).toBe(toPaisa(200_000));
    expect(houseFunded(400_000, [])).toBe(toPaisa(400_000));
    expect(houseFunded(400_000, [funding(400_000)])).toBe(0);
  });
});

describe('allocateLoss (BR-20)', () => {
  /** The §O deal again: 400,000 cost, 100,000 markup, 100,000 down. */
  const TERMS = { down_payment: 100_000, markup_amount: 100_000 };

  const half = {
    investor_id: 1,
    amount: toPaisa(200_000),
    share_pct: '50.00',
    profit_share_pct: '50.00',
    funded_from_principal: toPaisa(200_000),
    funded_from_profit: 0,
  };

  const participating = new Map([[1, true]]);

  it('charges the whole stake when nothing but the down payment arrived', () => {
    const result = allocateLoss({ ...TERMS, paid: 0 }, [half], participating);

    // 50,000 of the 100,000 down payment was their half; 150,000 did not
    // come back.
    expect(result.lines[0].unrecovered).toBe(toPaisa(150_000));
    expect(result.investor_borne).toBe(toPaisa(150_000));
    expect(result.house_absorbed).toBe(0);
  });

  it('writes nothing off once the stake has fully returned', () => {
    // 300,000 paid plus the 100,000 down is 400,000; their half is 200,000,
    // which is the whole stake.
    const result = allocateLoss(
      { ...TERMS, paid: toPaisa(300_000) },
      [half],
      participating,
    );

    expect(result.lines[0].unrecovered).toBe(0);
    expect(result.investor_borne).toBe(0);
  });

  it('charges the buckets the funding was drawn from', () => {
    const mixed = {
      ...half,
      funded_from_principal: toPaisa(120_000),
      funded_from_profit: toPaisa(80_000),
    };

    const result = allocateLoss({ ...TERMS, paid: 0 }, [mixed], participating);
    const line = result.lines[0];

    // BR-19 returned the 50,000 slice 60:40, so 30,000 of principal and
    // 20,000 of profit are already home. What is left is charged as it lies.
    expect(line.from_principal).toBe(toPaisa(90_000));
    expect(line.from_profit).toBe(toPaisa(60_000));
    expect(line.from_principal + line.from_profit).toBe(line.unrecovered);
  });

  it('puts the charge on the house where the investor does not participate', () => {
    const result = allocateLoss(
      { ...TERMS, paid: 0 },
      [half],
      new Map([[1, false]]),
    );

    expect(result.lines[0].participates).toBe(false);
    expect(result.investor_borne).toBe(0);
    expect(result.house_absorbed).toBe(toPaisa(150_000));
  });

  it('treats a missing participation flag as participating', () => {
    const result = allocateLoss({ ...TERMS, paid: 0 }, [half], new Map());

    expect(result.lines[0].participates).toBe(true);
  });

  it('extinguishes unmatured profit rather than paying it', () => {
    const result = allocateLoss({ ...TERMS, paid: 0 }, [half], participating);

    // 100,000 markup x 50% share x 50% profit share = 25,000, none of which
    // matured, because capital never came home.
    expect(result.lines[0].extinguished_profit).toBe(toPaisa(25_000));
    expect(result.extinguished_profit).toBe(toPaisa(25_000));
  });

  it('splits a shortfall across two funders without losing a paisa', () => {
    const a = { ...half, investor_id: 1, amount: toPaisa(200_000) };
    const b = {
      investor_id: 2,
      amount: toPaisa(100_000),
      share_pct: '25.00',
      profit_share_pct: '40.00',
      funded_from_principal: toPaisa(100_000),
      funded_from_profit: 0,
    };

    // An odd figure, so the split cannot come out even.
    const result = allocateLoss(
      { ...TERMS, paid: toPaisa(33_333.33) },
      [a, b],
      new Map([
        [1, true],
        [2, true],
      ]),
    );

    const recovered = splitRecovery({ ...TERMS, paid: toPaisa(33_333.33) }, [
      a,
      b,
    ]);

    for (const [index, line] of result.lines.entries()) {
      expect(line.from_principal + line.from_profit).toBe(line.unrecovered);
      expect(line.unrecovered).toBe(
        [a, b][index].amount - recovered.shares[index].capital_recovered,
      );
    }
  });

  it('has nothing to allocate on a contract nobody funded', () => {
    const result = allocateLoss({ ...TERMS, paid: 0 }, [], new Map());

    expect(result.lines).toEqual([]);
    expect(result.investor_borne).toBe(0);
    expect(result.house_absorbed).toBe(0);
  });
});
