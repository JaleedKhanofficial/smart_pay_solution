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

/** FR-BIN-02. Funding frozen when a contract was deleted. */
export type ContractRestoreFunding = {
    investor_id: number;
    investor_name: string;
    amount: string;
    share_pct: string;
    funded_from_principal: string;
    funded_from_profit: string;
};

export type ContractRestorePreview = {
    contract_id: number;
    captured_at: string | null;
    fundings: ContractRestoreFunding[];
    investors: Array<{ id: number; full_name: string; available: string }>;
};

export type RestoreContractBody = {
    fundings: Array<{ investor_id: number }>;
};
