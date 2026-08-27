import type { FormState } from "./customer";

export type SettingGroup =
    | "business"
    | "contracts"
    | "payments"
    | "recovery"
    | "retention";

export type BusinessIdentity = {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    email: string;
};

/** BR-06-v2. The inclusive upper bound of each band but the last, in days. */
export type PunctualityThresholds = [number, number, number, number, number];

/** BR-07. Where the tier boundaries sit, and what each one advises. */
export type LoyaltyThresholds = {
    gold_min_within_pct: number;
    silver_max_late_pct: number;
    platinum_reduction_pct: number;
    gold_reduction_pct: number;
    silver_reduction_pct: number;
};

/**
 * FR-SET-01. One key as the API describes it. The label, description and
 * default all come from the server's registry, so the screen cannot describe a
 * setting differently from the module that reads it.
 */
export type Setting = {
    key: string;
    group: SettingGroup;
    label: string;
    description: string;
    value: unknown;
    default: unknown;
    /** False while no module reads it yet — the screen says so plainly. */
    in_effect: boolean;
    updated_at: string | null;
};

export const GROUP_TITLES: Record<SettingGroup, string> = {
    business: "Business identity",
    contracts: "Contracts",
    payments: "Payments",
    recovery: "Recovery grading",
    retention: "Retention",
};

export const GROUP_BLURBS: Record<SettingGroup, string> = {
    business: "Heads every printed agreement.",
    contracts: "The bounds a new contract must fall inside.",
    payments: "How collection behaves at the counter.",
    recovery: "How punctuality is judged and how loyalty is awarded.",
    retention: "How long deleted records stay restorable.",
};

export type { FormState };
