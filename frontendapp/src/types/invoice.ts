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

/** FR-INV-01..05, FR-INV-07. One payload, because the document prints whole. */
export type Invoice = {
    contract: ContractDetail;
    customer: Customer;
    business: BusinessIdentity;
    issued_at: string;
};
