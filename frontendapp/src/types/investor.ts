import type { FormState, Paginated } from "./customer";

export type InvestorStatus = "active" | "inactive";
export type Bucket = "principal" | "profit";
export type TxnType = "Deposit" | "Withdrawal" | "Adjustment" | "Loss";
export type PaymentMethod = "Cash" | "Bank Transfer" | "Cheque";

/** FR-IVT-02. The stored terms; every money figure is derived. */
export type Investor = {
    id: number;
    full_name: string;
    father_husband_name: string;
    cnic_number: string;
    mobile_number: string;
    address: string;
    email: string | null;
    loss_participation: boolean;
    agreement_date: string | null;
    status: InvestorStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
};

/** FR-IVT-01. A register row: terms plus the derived position. */
export type InvestorRow = Investor & {
    net_principal: string;
    lifetime_profit: string;
    available: string;
    deployed: string;
    payable: string;
};

/** FR-IVT-09. The KPI strip, all of it derived (BR-21, BR-24, BR-24a). */
export type InvestorBalances = {
    net_principal: string;
    principal_available: string;
    principal_deployed: string;
    lifetime_profit: string;
    profit_available: string;
    profit_deployed: string;
    available: string;
    deployed: string;
    payable: string;
    return_on_principal: string;
    capital_turnover: string;
    cumulative_growth: string;
};

export type InvestorTransaction = {
    id: number;
    investor_id: number;
    type: TxnType;
    bucket: Bucket;
    /** Signed for an Adjustment; positive for everything else. */
    amount: string;
    txn_date: string;
    method: PaymentMethod | null;
    reference: string | null;
    contract_id: number | null;
    reason: string | null;
    entered_by: number;
    entered_by_name: string;
    created_at: string;
};

export type InvestorDetail = Investor & {
    balances: InvestorBalances;
    transactions: InvestorTransaction[];
};

export const PAYMENT_METHODS: PaymentMethod[] = [
    "Cash",
    "Bank Transfer",
    "Cheque",
];

/**
 * FR-CON-11. An investor the funding panel may offer, with what they can
 * actually deploy right now. Only investors with a balance appear.
 */
export type FundableInvestor = {
    id: number;
    full_name: string;
    available: string;
};

/** FR-CON-11. A funding line as stored — fixed at activation (FR-CON-15). */
export type ContractFunding = {
    id: number;
    investor_id: number;
    investor_name: string;
    amount: string;
    share_pct: string;
    funded_from_principal: string;
    funded_from_profit: string;
    /** BR-23. Recovered capital or matured profit paid for this. */
    reinvested: boolean;
    funded_at: string;
};

/**
 * BR-20 / FR-CON-16. What writing a contract off would cost one funder, read
 * before anyone commits to it.
 */
export type LossPreview = {
    investor_id: number;
    investor_name: string;
    funded: string;
    recovered: string;
    unrecovered: string;
    from_principal: string;
    from_profit: string;
    extinguished_profit: string;
    /** False: the house absorbs it and this investor loses nothing. */
    participates: boolean;
};

export type InvestorFilterValues = { search: string; status: string };
export const EMPTY_FILTERS: InvestorFilterValues = { search: "", status: "" };

export type { FormState, Paginated };
