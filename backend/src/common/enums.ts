/**
 * The six PostgreSQL enum types from SRS §5. The `enumName` given on each
 * column must match the type name in the database exactly, so the members here
 * are the single source of truth for both TypeScript and the DDL.
 */

export enum Role {
  admin = 'admin',
  operator = 'operator',
}

export enum UserStatus {
  active = 'active',
  disabled = 'disabled',
}

export enum ProductStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}

export enum ProductCondition {
  New = 'New',
  Used = 'Used',
}

export enum ContractStatus {
  active = 'active',
  completed = 'completed',
  cancelled = 'cancelled',
}

export enum PaymentMethod {
  Cash = 'Cash',
  /** Stored with a space, as the v1 database wrote it. */
  BankTransfer = 'Bank Transfer',
  Cheque = 'Cheque',
}

export enum InvestorStatus {
  active = 'active',
  inactive = 'inactive',
}

/** Only Deposit, Withdrawal and Adjustment are hand-entered (FR-IVT-07). */
export enum InvestorTxnType {
  Deposit = 'Deposit',
  Withdrawal = 'Withdrawal',
  Adjustment = 'Adjustment',
  Loss = 'Loss',
}

/** The two halves of an investor's money (BR-21). Both are redeployable. */
export enum InvestorBucket {
  principal = 'principal',
  profit = 'profit',
}

/** One value on purpose: investor money is never a capital entry (FR-SUM-10). */
export enum CapitalSource {
  own = 'own',
}

export enum SnapshotKind {
  recovery = 'recovery',
  investor = 'investor',
}
