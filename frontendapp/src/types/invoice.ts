import type { ContractDetail } from "./contract";
import type { Customer } from "./customer";

/** FR-SET-01. The letterhead block; Module 12 will make it editable. */
export type BusinessIdentity = {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    email: string;
};

/** FR-INV-03. What has actually been collected against one installment. */
export type InvoiceReceipt = {
    seq: number;
    /** Applied oldest due date first (BR-13), so this is not "the payment". */
    amount: string;
    /** The date the installment was cleared; null while it is still short. */
    completed_on: string | null;
};

/** FR-INV-01..05, FR-INV-07. One payload, because the document prints whole. */
export type Invoice = {
    contract: ContractDetail;
    customer: Customer;
    business: BusinessIdentity;
    /** Empty on a fresh agreement, where the column is signed by hand. */
    received: InvoiceReceipt[];
    issued_at: string;
};
