import {
  absorbedByHouse,
  expensesByInvestor,
  splitCommonExpense,
  type PeriodMember,
} from './expenses';
import { toPaisa } from './money';

/** The six on the books in August 2026, in the order the sheet lists them. */
const SIX: PeriodMember[] = [
  { investor_id: 1, waived: false }, // AS
  { investor_id: 2, waived: false }, // NK
  { investor_id: 3, waived: false }, // MH
  { investor_id: 4, waived: false }, // HA
  { investor_id: 5, waived: false }, // SHR
  { investor_id: 6, waived: false }, // AB
];

/** HA is closing out, so Common-1 is not charged to them. */
const WITHOUT_HA: PeriodMember[] = SIX.map((member) => ({
  ...member,
  waived: member.investor_id === 4,
}));

describe('splitCommonExpense (BR-28)', () => {
  it('splits the August common pot as the sheet does', () => {
    const split = splitCommonExpense(24_550, SIX);

    // 24,550 / 6 is 4,091.666…, which no two-decimal figure can hold six
    // times over. `allocate` gives five of them 4,091.67 and settles the
    // 2-paisa residual on the first, so the six come to 24,550 exactly.
    expect(split.shares.map((share) => share.share)).toEqual([
      409_165, 409_167, 409_167, 409_167, 409_167, 409_167,
    ]);
  });

  it('never loses a paisa, however the pot divides', () => {
    for (const total of [24_550, 700, 1, 99_999.99, 0.03]) {
      const split = splitCommonExpense(total, SIX);
      const sum = split.shares.reduce((carry, share) => carry + share.share, 0);

      expect(sum).toBe(toPaisa(total));
    }
  });

  it('leaves a waived member out and does not reprice the others', () => {
    const split = splitCommonExpense(24_550, WITHOUT_HA);
    const ha = split.shares.find((share) => share.investor_id === 4);

    expect(ha?.share).toBe(0);
    expect(ha?.waived).toBe(true);

    // The other five each carry what they always carried — 4,092 to the
    // rupee, not the 4,910 they would owe if HA's share were shared out
    // between them.
    for (const share of split.shares.filter((row) => !row.waived)) {
      expect(Math.round(share.share / 100)).toBe(4_092);
    }
  });

  it('reports the waived share as absorbed by the business', () => {
    const split = splitCommonExpense(24_550, WITHOUT_HA);

    // HA's sixth, 4,091.67, is carried by the business. The sheet shows the
    // same gap: its five columns of 4,092 come to 20,460 of a 24,550 pot.
    expect(split.absorbed).toBe(409_167);
    expect(split.divided_between).toBe(5);

    const billed = split.shares.reduce((carry, row) => carry + row.share, 0);

    expect(billed).toBe(toPaisa(24_550) - split.absorbed);
    expect(Math.round(billed / 100)).toBe(20_458);
  });

  it('charges the business the whole pot when everyone is waived', () => {
    const split = splitCommonExpense(
      5_000,
      SIX.map((m) => ({ ...m, waived: true })),
    );

    expect(split.shares.every((share) => share.share === 0)).toBe(true);
    expect(split.absorbed).toBe(toPaisa(5_000));
    expect(split.divided_between).toBe(0);
  });
});

describe('expensesByInvestor (BR-31)', () => {
  /** The two August pots, and each investor's own costs. */
  const PERIODS = [
    { period_id: 1, total: 24_550, members: WITHOUT_HA },
    { period_id: 2, total: 700, members: SIX },
  ];

  const INDIVIDUAL = [
    { investor_id: 1, amount: 1_350 },
    { investor_id: 2, amount: 10_780 },
    { investor_id: 3, amount: 990 },
    { investor_id: 4, amount: 950 },
    { investor_id: 5, amount: 2_750 },
    { investor_id: 6, amount: 50 },
  ];

  const rows = expensesByInvestor(PERIODS, INDIVIDUAL);
  const find = (id: number) => rows.find((row) => row.investor_id === id);

  it('reproduces the sheet, investor by investor', () => {
    // 4,091.67 + 116.67 + their own, read to the rupee — which is all the
    // sheet shows, and every one of them agrees with it.
    const rupees = (id: number) => Math.round((find(id)?.total ?? 0) / 100);

    expect(rupees(1)).toBe(5_558); // AS
    expect(rupees(2)).toBe(14_988); // NK
    expect(rupees(3)).toBe(5_198); // MH
    expect(rupees(4)).toBe(1_067); // HA
    expect(rupees(5)).toBe(6_958); // SHR
    expect(rupees(6)).toBe(4_258); // AB
  });

  it('charges a waived investor their individual costs all the same', () => {
    // HA carries no Common-1, but Common-2 and their own 950 still stand.
    expect(find(4)?.common_total).toBe(11_667);
    expect(find(4)?.individual).toBe(toPaisa(950));
    expect(find(4)?.total).toBe(106_667); // 1,066.67, shown as 1,067
  });

  it('adds up to the pots plus the individual costs, exactly', () => {
    const billed = rows.reduce((carry, row) => carry + row.total, 0);
    const individual = INDIVIDUAL.reduce(
      (carry, row) => carry + toPaisa(row.amount),
      0,
    );

    // Nothing is created or lost between the pots and the people: what the
    // investors carry plus what the business absorbs is the whole spend.
    expect(billed + absorbedByHouse(PERIODS)).toBe(
      toPaisa(24_550) + toPaisa(700) + individual,
    );
  });

  it('is the figure the sheet gets a rupee wrong', () => {
    const billed = rows.reduce((carry, row) => carry + row.total, 0);

    // 38,028.33 to the paisa, which reads as 38,028 — the same figure the
    // sheet's footer shows. Its own rounded rows come to 38,027, and that
    // one-rupee disagreement is what splitting in paisa avoids.
    expect(billed).toBe(3_802_833);
    expect(Math.round(billed / 100)).toBe(38_028);
  });

  it('lists an investor with no expenses at all rather than dropping them', () => {
    const only = expensesByInvestor(
      [{ period_id: 1, total: 0, members: SIX }],
      [],
    );

    expect(only).toHaveLength(6);
    expect(only.every((row) => row.total === 0)).toBe(true);
  });
});
