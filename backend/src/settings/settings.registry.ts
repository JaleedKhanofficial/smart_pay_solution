import { DEFAULT_BUSINESS_IDENTITY } from '../contracts/invoice.mapper';
import type { BusinessIdentity } from '../contracts/invoice.mapper';

/**
 * FR-SET-01. Every setting the system has, declared **once**.
 *
 * Before this file each key lived wherever it was read — `allow_overpayment`
 * in the payments service, the plan range in the contracts service, the
 * letterhead in the invoice mapper — each with its own default and its own
 * cast out of JSONB. A key could be renamed in one place and silently keep
 * returning its fallback in another. The registry is the single source of
 * truth: a reader that asks for a key it has not declared will not compile,
 * and the admin screen is generated from the same list.
 *
 * Adding a setting is one entry here, plus a line in `SettingValues`.
 */

/** BR-06-v2. The inclusive upper bound of each band but the last, in days. */
export type PunctualityThresholds = [number, number, number, number, number];

/** BR-07. The tests and the advisory reductions. */
export type LoyaltyThresholds = {
  /** Gold needs at least this share within the first two bands. */
  gold_min_within_pct: number;
  /** Silver needs fewer than this share in the 15-days-and-later bands. */
  silver_max_late_pct: number;
  platinum_reduction_pct: number;
  gold_reduction_pct: number;
  silver_reduction_pct: number;
};

/** The typed shape of every key. Adding a key starts here. */
export type SettingValues = {
  business_identity: BusinessIdentity;
  allow_overpayment: boolean;
  plan_months_min: number;
  plan_months_max: number;
  punctuality_thresholds: PunctualityThresholds;
  loyalty: LoyaltyThresholds;
  recycle_bin_retention_days: number;
};

export type SettingKey = keyof SettingValues;

/** Screens group by this; the order here is the order on the page. */
export const SETTING_GROUPS = [
  'business',
  'contracts',
  'payments',
  'recovery',
  'retention',
] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number];

export type SettingDefinition<T> = {
  group: SettingGroup;
  label: string;
  description: string;
  default: T;
  /**
   * Validates and narrows a value that came off the wire or out of JSONB.
   * Throws with a human sentence; the service turns that into a 400 naming
   * the field. A stored value that no longer parses falls back to the default
   * rather than propagating nonsense — a bad row must not break the invoice.
   */
  parse: (value: unknown) => T;
  /** True once something actually reads it. Shown on the screen as a warning. */
  in_effect: boolean;
};

function fail(message: string): never {
  throw new Error(message);
}

function parseBoolean(label: string) {
  return (value: unknown): boolean =>
    typeof value === 'boolean' ? value : fail(`${label} must be true or false`);
}

function parseInteger(label: string, min: number, max: number) {
  return (value: unknown): number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
      ? value
      : fail(`${label} must be a whole number between ${min} and ${max}`);
}

function parseText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseIdentity(value: unknown): BusinessIdentity {
  if (typeof value !== 'object' || value === null) {
    fail('The business identity must be a block of text fields');
  }

  const raw = value as Record<string, unknown>;

  const name = parseText(raw.name);

  if (name === '') {
    fail(
      'The business name cannot be empty — it heads every printed agreement',
    );
  }

  return {
    name,
    tagline: parseText(raw.tagline),
    address: parseText(raw.address),
    phone: parseText(raw.phone),
    email: parseText(raw.email),
  };
}

function parseThresholds(value: unknown): PunctualityThresholds {
  if (!Array.isArray(value) || value.length !== 5) {
    fail('The punctuality bands need exactly five upper bounds, in days');
  }

  const days = value.map((entry) =>
    typeof entry === 'number' &&
    Number.isInteger(entry) &&
    entry >= 0 &&
    entry <= 365
      ? entry
      : fail('Each punctuality bound must be a whole number of days, 0 to 365'),
  );

  // Bands that do not ascend would leave gaps or overlaps, and a payment could
  // fall into two of them or none.
  for (let i = 1; i < days.length; i += 1) {
    if (days[i] <= days[i - 1]) {
      fail('Each punctuality bound must be larger than the one before it');
    }
  }

  return days as PunctualityThresholds;
}

function parseLoyalty(value: unknown): LoyaltyThresholds {
  if (typeof value !== 'object' || value === null) {
    fail('The loyalty thresholds must be a block of percentages');
  }

  const raw = value as Record<string, unknown>;
  const pct = (key: keyof LoyaltyThresholds, label: string): number =>
    typeof raw[key] === 'number' && raw[key] >= 0 && raw[key] <= 100
      ? Math.round(raw[key] * 100) / 100
      : fail(`${label} must be a percentage between 0 and 100`);

  return {
    gold_min_within_pct: pct('gold_min_within_pct', 'The Gold threshold'),
    silver_max_late_pct: pct('silver_max_late_pct', 'The Silver threshold'),
    platinum_reduction_pct: pct(
      'platinum_reduction_pct',
      'The Platinum reduction',
    ),
    gold_reduction_pct: pct('gold_reduction_pct', 'The Gold reduction'),
    silver_reduction_pct: pct('silver_reduction_pct', 'The Silver reduction'),
  };
}

export const SETTING_DEFINITIONS: {
  [K in SettingKey]: SettingDefinition<SettingValues[K]>;
} = {
  business_identity: {
    group: 'business',
    label: 'Letterhead',
    description:
      'Heads the printed agreement (FR-INV-01). The name is required; the rest print only when filled in.',
    default: DEFAULT_BUSINESS_IDENTITY,
    parse: parseIdentity,
    in_effect: true,
  },

  plan_months_min: {
    group: 'contracts',
    label: 'Shortest plan',
    description: 'A contract may not be written for fewer months than this.',
    default: 1,
    parse: parseInteger('The shortest plan', 1, 120),
    in_effect: true,
  },

  plan_months_max: {
    group: 'contracts',
    label: 'Longest plan',
    description: 'A contract may not be written for more months than this.',
    default: 20,
    parse: parseInteger('The longest plan', 1, 120),
    in_effect: true,
  },

  allow_overpayment: {
    group: 'payments',
    label: 'Allow overpayment',
    description:
      'Off, a payment above the outstanding balance is refused (FR-PAY-06-v2). On, it is accepted after the collector confirms the overage.',
    default: false,
    parse: parseBoolean('Allow overpayment'),
    in_effect: true,
  },

  punctuality_thresholds: {
    group: 'recovery',
    label: 'Punctuality bands',
    description:
      'BR-06-v2. The last day of each band, counted from the due date. The final band runs from the last bound onwards.',
    default: [4, 9, 14, 19, 24],
    parse: parseThresholds,
    in_effect: true,
  },

  loyalty: {
    group: 'recovery',
    label: 'Loyalty tiers',
    description:
      'BR-07. Where the tier boundaries sit, and the reduction each one advises. Advisory only — never applied automatically.',
    default: {
      gold_min_within_pct: 80,
      silver_max_late_pct: 50,
      platinum_reduction_pct: 5,
      gold_reduction_pct: 3,
      silver_reduction_pct: 1,
    },
    parse: parseLoyalty,
    in_effect: true,
  },

  recycle_bin_retention_days: {
    group: 'retention',
    label: 'Recycle Bin retention',
    description:
      'How long a soft-deleted record stays restorable before it may be purged.',
    default: 90,
    parse: parseInteger('The retention period', 1, 3650),
    // Module 10 is not built, so nothing reads this yet. Saying so on the
    // screen is better than a control that silently does nothing.
    in_effect: false,
  },
};

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];
