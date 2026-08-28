import { ConflictException } from '@nestjs/common';
import { EntityManager, IsNull, Not } from 'typeorm';
import { ContractStatus } from '../common/enums';
import {
  AuditLog,
  Contract,
  ContractFunding,
  Customer,
  File,
  Guarantor,
  Installment,
  Payment,
  Product,
  User,
} from '../database/entities';

/**
 * FR-BIN-01..03. Everything the Recycle Bin knows about an entity, declared
 * once per kind.
 *
 * Restoring and purging are not generic operations — each entity has its own
 * reason it might not be safe. Rather than a switch statement in the service
 * that grows a branch per kind, each kind states its own rules here and the
 * service is the same six lines for all of them.
 */

export const BIN_KINDS = [
  'customer',
  'product',
  'contract',
  'payment',
  'user',
] as const;

export type BinKind = (typeof BIN_KINDS)[number];

/** One deleted record as the screen lists it. */
export type BinRow = {
  kind: BinKind;
  id: number;
  title: string;
  subtitle: string;
  deleted_at: string;
  /** Why it cannot be restored, or null when it can. */
  restore_blocked: string | null;
  /** Why it cannot be purged, or null when it can. */
  purge_blocked: string | null;
};

type Describe<T> = (row: T) => { title: string; subtitle: string };

/**
 * What every binnable row has in common. `deleted_at` is part of it because
 * the bin is defined by that column — a kind without one does not belong here.
 */
export type BinRecord = { id: number; deleted_at: Date | null };

export type BinDefinition<T extends BinRecord> = {
  kind: BinKind;
  label: string;
  /** TypeORM entity class, used for every read and write. */
  entity: new () => T;
  /**
   * Relations `describe` needs, in TypeORM's string form. Strings rather than
   * the object form on purpose: the object form is typed against one entity
   * and cannot survive the generic being erased for the shared map below.
   */
  relations?: string[];
  describe: Describe<T>;
  /** Null when restoring is safe, otherwise the sentence explaining why not. */
  restoreBlocker: (row: T, manager: EntityManager) => Promise<string | null>;
  /** Null when purging is safe, otherwise the sentence explaining why not. */
  purgeBlocker: (row: T, manager: EntityManager) => Promise<string | null>;
  /**
   * Deletes the record for good, plus anything that belongs to it and nothing
   * that does not. Every foreign key in this schema is ON DELETE RESTRICT, so
   * a cascade is written out here rather than left to the database — which
   * means it is reviewable, and it cannot reach further than intended.
   */
  purge: (row: T, manager: EntityManager) => Promise<void>;
  /** Run inside the restore transaction, after `deleted_at` is cleared. */
  afterRestore?: (row: T, manager: EntityManager) => Promise<void>;
};

/** Nothing ever blocks this operation for this kind. */
const never = (): Promise<string | null> => Promise.resolve(null);

/** Money is a string in this schema; paisa keeps the comparison exact. */
function paisa(amount: string): number {
  return Math.round(Number(amount) * 100);
}

export const CUSTOMER_DEFINITION: BinDefinition<Customer> = {
  kind: 'customer',
  label: 'Customer',
  entity: Customer,
  describe: (row) => ({
    title: row.full_name,
    subtitle: `${row.cnic_number} · ${row.mobile_number}`,
  }),

  // FR-BIN-02. `uq_customers_cnic_live` only covers live rows, so the CNIC was
  // released the moment this one was deleted and may have been reused since.
  restoreBlocker: async (row, manager) => {
    const clash = await manager.findOne(Customer, {
      where: { cnic_number: row.cnic_number, id: Not(row.id) },
    });

    return clash
      ? `CNIC ${row.cnic_number} now belongs to ${clash.full_name}. Change or remove that record first.`
      : null;
  },

  // FR-BIN-03 names this case explicitly: contracts go first.
  purgeBlocker: async (row, manager) => {
    const contracts = await manager.count(Contract, {
      where: { customer_id: row.id },
      withDeleted: true,
    });

    return contracts > 0
      ? `${row.full_name} still has ${contracts} contract${contracts === 1 ? '' : 's'}. Purge those first.`
      : null;
  },

  purge: async (row, manager) => {
    // Guarantors exist only as part of a customer and are not soft-deletable,
    // so they go with them. Files are left alone: the bytes are on disk, and
    // dropping the row would orphan them.
    await manager.delete(Guarantor, { customer_id: row.id });
    await manager.delete(Customer, { id: row.id });
  },
};

export const PRODUCT_DEFINITION: BinDefinition<Product> = {
  kind: 'product',
  label: 'Product',
  entity: Product,
  describe: (row) => ({
    title: row.name,
    subtitle: row.status,
  }),

  // Product names are indexed but not unique, so nothing blocks a restore.
  restoreBlocker: never,

  purgeBlocker: async (row, manager) => {
    const contracts = await manager.count(Contract, {
      where: { product_id: row.id },
      withDeleted: true,
    });

    return contracts > 0
      ? `${row.name} is on ${contracts} contract${contracts === 1 ? '' : 's'}. Purge those first.`
      : null;
  },

  purge: async (row, manager) => {
    await manager.delete(Product, { id: row.id });
  },
};

export const CONTRACT_DEFINITION: BinDefinition<Contract> = {
  kind: 'contract',
  label: 'Contract',
  entity: Contract,
  relations: ['customer', 'product'],
  describe: (row) => ({
    title: `SPS-${String(row.id).padStart(4, '0')}`,
    subtitle: `${row.customer?.full_name ?? 'customer'} · ${row.product?.name ?? 'product'} · Rs. ${row.financed_amount}`,
  }),

  // A contract cannot be restored onto a customer or product that is itself
  // still in the bin — the register would show a row pointing at nothing.
  restoreBlocker: async (row, manager) => {
    const customer = await manager.findOne(Customer, {
      where: { id: row.customer_id },
    });

    if (!customer) {
      return 'Its customer is deleted. Restore the customer first.';
    }

    const product = await manager.findOne(Product, {
      where: { id: row.product_id },
    });

    return product
      ? null
      : 'Its product is deleted. Restore the product first.';
  },

  /**
   * BR-20 says purging a **funded** contract writes Loss rows against the
   * investors whose capital did not come back. That allocation is not built
   * yet, so the purge is refused rather than performed without it — deleting
   * the funding rows would erase someone's stake and leave their balance
   * quietly wrong, which is worse than refusing.
   */
  purgeBlocker: async (row, manager) => {
    const funders = await manager.count(ContractFunding, {
      where: { contract_id: row.id },
    });

    return funders > 0
      ? `This contract was funded by ${funders} investor${funders === 1 ? '' : 's'}. Purging it has to write off their unrecovered capital (BR-20), which is not built yet — so it cannot be purged.`
      : null;
  },

  purge: async (row, manager) => {
    // The schedule and the payments are the contract; nothing else references
    // them, and leaving either behind would orphan money. Funding rows are
    // not deleted here — the blocker above means there are none.
    await manager.delete(Payment, { contract_id: row.id });
    await manager.delete(Installment, { contract_id: row.id });
    await manager.delete(Contract, { id: row.id });
  },
};

export const PAYMENT_DEFINITION: BinDefinition<Payment> = {
  kind: 'payment',
  label: 'Voided payment',
  entity: Payment,
  relations: ['contract', 'contract.customer'],
  describe: (row) => ({
    title: `Rs. ${row.amount}`,
    subtitle: `${row.contract?.customer?.full_name ?? 'customer'} · ${row.payment_date} · ${row.void_reason ?? 'no reason recorded'}`,
  }),

  // Un-voiding puts money back on a contract, so the contract has to be there
  // to receive it.
  restoreBlocker: async (row, manager) => {
    const contract = await manager.findOne(Contract, {
      where: { id: row.contract_id },
    });

    return contract
      ? null
      : 'Its contract is deleted. Restore the contract first.';
  },

  purgeBlocker: never,

  purge: async (row, manager) => {
    await manager.delete(Payment, { id: row.id });
  },

  /**
   * BR-12, in the direction Module 6 does not cover. Restoring a void puts the
   * money back, which can settle a contract that had gone active again — so
   * the status is re-derived here rather than left stale until the next
   * payment happens to touch it.
   */
  afterRestore: async (row, manager) => {
    const contract = await manager.findOne(Contract, {
      where: { id: row.contract_id },
    });

    if (!contract) return;

    const live = await manager.find(Payment, {
      where: { contract_id: row.contract_id, deleted_at: IsNull() },
      select: { amount: true },
    });

    const paid = live.reduce((sum, payment) => sum + paisa(payment.amount), 0);
    const settled = paid >= paisa(contract.financed_amount);

    if (settled && contract.status === ContractStatus.active) {
      await manager.update(
        Contract,
        { id: contract.id },
        { status: ContractStatus.completed },
      );
    }
  },
};

export const USER_DEFINITION: BinDefinition<User> = {
  kind: 'user',
  label: 'Staff account',
  entity: User,
  describe: (row) => ({
    title: row.name,
    subtitle: `${row.email} · ${row.role}`,
  }),

  // `uq_users_email_live` covers live rows only, so the address may have been
  // taken by someone else since.
  restoreBlocker: async (row, manager) => {
    const clash = await manager.findOne(User, {
      where: { email: row.email, id: Not(row.id) },
    });

    return clash
      ? `${row.email} now belongs to ${clash.name}. Change that account's address first.`
      : null;
  },

  /**
   * A person who did things cannot be erased. Every audit row, payment and
   * upload keeps a RESTRICT foreign key to its actor, and that is the point:
   * the trail has to say who, and "who" has to still exist. In practice this
   * blocks almost every account, because logging in writes an audit row.
   */
  purgeBlocker: async (row, manager) => {
    const [audits, payments, files] = await Promise.all([
      manager.count(AuditLog, { where: { actor_id: row.id } }),
      manager.count(Payment, {
        where: { recorded_by: row.id },
        withDeleted: true,
      }),
      manager.count(File, { where: { uploaded_by: row.id } }),
    ]);

    const held = [
      audits > 0 ? `${audits} audit entr${audits === 1 ? 'y' : 'ies'}` : null,
      payments > 0 ? `${payments} payment${payments === 1 ? '' : 's'}` : null,
      files > 0 ? `${files} upload${files === 1 ? '' : 's'}` : null,
    ].filter(Boolean);

    return held.length > 0
      ? `${row.name} is named by ${held.join(', ')}. A record of who did something cannot be erased, so this account can be restored but never purged.`
      : null;
  },

  purge: async (row, manager) => {
    await manager.delete(User, { id: row.id });
  },
};

/**
 * Erases the entity generic so the five definitions can share one map.
 *
 * The cast is sound because of how the service uses the result: every row it
 * passes to a definition's functions was loaded from that same definition's
 * `entity`, so the value really is a `T`. TypeScript cannot see that across
 * the map, and the alternative — a switch with a branch per kind in every
 * method — is what this registry exists to avoid.
 */
function define<T extends BinRecord>(
  definition: BinDefinition<T>,
): BinDefinition<BinRecord> {
  return definition;
}

export const BIN_DEFINITIONS: Record<BinKind, BinDefinition<BinRecord>> = {
  customer: define(CUSTOMER_DEFINITION),
  product: define(PRODUCT_DEFINITION),
  contract: define(CONTRACT_DEFINITION),
  payment: define(PAYMENT_DEFINITION),
  user: define(USER_DEFINITION),
};

/** Turns a blocker sentence into the 409 the API returns. */
export function refuse(message: string): never {
  throw new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    message,
  });
}
