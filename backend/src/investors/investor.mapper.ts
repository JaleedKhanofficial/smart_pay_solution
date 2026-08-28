import type {
  InvestorBucket,
  InvestorStatus,
  InvestorTxnType,
  PaymentMethod,
} from '../common/enums';
import type { Investor, InvestorTransaction } from '../database/entities';

/** FR-IVT-02. The stored terms; every money figure is derived elsewhere. */
export type InvestorResponse = {
  id: number;
  full_name: string;
  father_husband_name: string;
  cnic_number: string;
  mobile_number: string;
  address: string;
  email: string | null;
  profit_share_pct: string;
  loss_participation: boolean;
  agreement_date: string | null;
  status: InvestorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** FR-IVT-01. A register row: the terms plus the derived position. */
export type InvestorRow = InvestorResponse & {
  net_principal: string;
  lifetime_profit: string;
  available: string;
  deployed: string;
  payable: string;
};

/**
 * FR-SUM-11. Every investor's position added together, for the Summary
 * Report's Investor block — the other side of what BR-25 nets out.
 */
export type InvestorPosition = {
  investors: number;
  /** Every Deposit ever recorded, whatever became of it. */
  deposited: string;
  withdrawn: string;
  /** Deposits less withdrawals, adjustments and losses (BR-24). */
  net_principal: string;
  principal_deployed: string;
  profit_deployed: string;
  deployed: string;
  /** Idle: deployable or withdrawable right now. */
  available: string;
  lifetime_profit: string;
  /** What the business owes them all if everything stopped today. */
  payable: string;
};

export type TransactionResponse = {
  id: number;
  investor_id: number;
  type: InvestorTxnType;
  bucket: InvestorBucket;
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

export function toInvestorResponse(investor: Investor): InvestorResponse {
  return {
    id: investor.id,
    full_name: investor.full_name,
    father_husband_name: investor.father_husband_name,
    cnic_number: investor.cnic_number,
    mobile_number: investor.mobile_number,
    address: investor.address,
    email: investor.email,
    profit_share_pct: investor.profit_share_pct,
    loss_participation: investor.loss_participation,
    agreement_date: investor.agreement_date,
    status: investor.status,
    notes: investor.notes,
    created_at: investor.created_at.toISOString(),
    updated_at: investor.updated_at.toISOString(),
  };
}

export function toTransactionResponse(
  row: InvestorTransaction,
): TransactionResponse {
  return {
    id: row.id,
    investor_id: row.investor_id,
    type: row.type,
    bucket: row.bucket,
    amount: row.amount,
    txn_date: row.txn_date,
    method: row.method,
    reference: row.reference,
    contract_id: row.contract_id,
    reason: row.reason,
    entered_by: row.entered_by,
    entered_by_name: row.enteredBy?.name ?? '',
    created_at: row.created_at.toISOString(),
  };
}
