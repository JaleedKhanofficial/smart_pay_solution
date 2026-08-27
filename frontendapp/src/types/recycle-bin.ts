import type { FormState } from "./customer";

export const BIN_KINDS = [
    "customer",
    "product",
    "contract",
    "payment",
    "user",
] as const;

export type BinKind = (typeof BIN_KINDS)[number];

/**
 * FR-BIN-01. One deleted record. The two `*_blocked` fields carry the reason
 * an action is unavailable, worked out by the server before the row was sent —
 * so a control can be disabled with an explanation rather than offered and
 * then refused.
 */
export type BinRow = {
    kind: BinKind;
    id: number;
    title: string;
    subtitle: string;
    deleted_at: string;
    restore_blocked: string | null;
    purge_blocked: string | null;
};

export type BinSummary = { kind: BinKind; label: string; count: number }[];

export type BinFilterValues = {
    kind: string;
    from: string;
};

export const EMPTY_FILTERS: BinFilterValues = { kind: "", from: "" };

export type { FormState };
