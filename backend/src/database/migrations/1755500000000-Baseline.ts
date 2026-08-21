import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The complete SPS v2 schema (SRS §5), as it stands after the four Prisma
 * migrations this replaces: the initial model, the integer customer key, the
 * readable upload names, the filename-as-file-key swap and the integer
 * guarantor key.
 *
 * Every statement is idempotent, because this migration has two jobs:
 *   - on a database that already holds the schema it changes nothing and simply
 *     records the baseline, so an existing install adopts TypeORM without a
 *     dump and restore;
 *   - on an empty database it builds the whole schema from scratch.
 */

const ENUM_TYPES: Array<{ name: string; values: string[] }> = [
  { name: 'Role', values: ['admin', 'operator'] },
  { name: 'UserStatus', values: ['active', 'disabled'] },
  { name: 'ProductStatus', values: ['Active', 'Inactive'] },
  { name: 'ProductCondition', values: ['New', 'Used'] },
  { name: 'ContractStatus', values: ['active', 'completed', 'cancelled'] },
  { name: 'PaymentMethod', values: ['Cash', 'Bank Transfer', 'Cheque'] },
];

const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'operator',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
  )`,
  // The primary key is the filename (SRS §2.7 deviation 2), so cnic_file_id
  // reads as "Ali Raza - 35201-1234567-1 - 18-08-2026.png".
  `CREATE TABLE IF NOT EXISTS "files" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
  )`,
  // Sequential id (SRS §2.7 deviation 1) so staff can quote a short reference.
  `CREATE TABLE IF NOT EXISTS "customers" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "father_husband_name" VARCHAR(150) NOT NULL,
    "cnic_number" VARCHAR(15) NOT NULL,
    "mobile_number" VARCHAR(20) NOT NULL,
    "address" TEXT NOT NULL,
    "occupation" VARCHAR(120) NOT NULL,
    "monthly_income" DECIMAL(12,2) NOT NULL,
    "cnic_file_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "guarantors" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "father_name" VARCHAR(150) NOT NULL,
    "relationship" VARCHAR(60) NOT NULL,
    "cnic_number" VARCHAR(15) NOT NULL,
    "mobile_number" VARCHAR(20) NOT NULL,
    "address" TEXT NOT NULL,
    "cnic_file_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guarantors_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "product_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "category_id" UUID NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "sale_price" DECIMAL(12,2) NOT NULL,
    "markup_pct" DECIMAL(5,2) NOT NULL,
    "markup_amount" DECIMAL(12,2) NOT NULL,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "down_payment" DECIMAL(12,2) NOT NULL,
    "financed_amount" DECIMAL(12,2) NOT NULL,
    "monthly_installment" DECIMAL(12,2) NOT NULL,
    "plan_months" INTEGER NOT NULL,
    "product_condition" "ProductCondition" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "write_off" BOOLEAN NOT NULL DEFAULT false,
    "terms_locked_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "recorded_by" UUID NOT NULL,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "ledger_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "snapshot_no" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "pdf_file_id" TEXT,
    "created_by" UUID NOT NULL,
    "legacy" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_snapshots_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "capital_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "amount" DECIMAL(12,2) NOT NULL,
    "period_label" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "entered_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "capital_entries_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "expense_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "amount" DECIMAL(12,2) NOT NULL,
    "period_label" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "entered_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "expense_entries_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "summary_scenarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "summary_scenarios_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
  )`,
  `CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64),
    "action" VARCHAR(40) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
  )`,
];

const INDEXES: string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash")`,
  `CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id")`,
  `CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "files_storage_path_key" ON "files"("storage_path")`,
  `CREATE INDEX IF NOT EXISTS "customers_full_name_idx" ON "customers"("full_name")`,
  `CREATE INDEX IF NOT EXISTS "customers_cnic_number_idx" ON "customers"("cnic_number")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "guarantors_customer_id_position_key" ON "guarantors"("customer_id", "position")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_name_key" ON "product_categories"("name")`,
  `CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products"("name")`,
  `CREATE INDEX IF NOT EXISTS "contracts_customer_id_idx" ON "contracts"("customer_id")`,
  `CREATE INDEX IF NOT EXISTS "contracts_product_id_idx" ON "contracts"("product_id")`,
  `CREATE INDEX IF NOT EXISTS "contracts_status_idx" ON "contracts"("status")`,
  `CREATE INDEX IF NOT EXISTS "installments_due_date_idx" ON "installments"("due_date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "installments_contract_id_seq_key" ON "installments"("contract_id", "seq")`,
  `CREATE INDEX IF NOT EXISTS "payments_contract_id_idx" ON "payments"("contract_id")`,
  `CREATE INDEX IF NOT EXISTS "payments_payment_date_idx" ON "payments"("payment_date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ledger_snapshots_snapshot_no_key" ON "ledger_snapshots"("snapshot_no")`,
  `CREATE INDEX IF NOT EXISTS "ledger_snapshots_contract_id_idx" ON "ledger_snapshots"("contract_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "summary_scenarios_user_id_name_key" ON "summary_scenarios"("user_id", "name")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at")`,
  // Partial uniqueness: uniqueness applies to live rows only, so a soft-deleted
  // record never blocks reuse of its email or CNIC (SRS §5.1, FR-CUS-08).
  // TypeORM cannot express these in an entity, which is why they live here.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email_live" ON "users"("email") WHERE "deleted_at" IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_customers_cnic_live" ON "customers"("cnic_number") WHERE "deleted_at" IS NULL`,
];

/**
 * Every table carrying `updated_at`. TypeORM writes `DEFAULT` for an
 * @UpdateDateColumn on INSERT and lets the database supply the value, so the
 * column needs a default of its own — Prisma set it from the client instead and
 * left the column bare. Adding a default never rewrites existing rows, and
 * re-running it is harmless.
 */
const UPDATED_AT_TABLES: string[] = [
  'users',
  'customers',
  'guarantors',
  'product_categories',
  'products',
  'contracts',
  'payments',
  'capital_entries',
  'expense_entries',
  'summary_scenarios',
  'settings',
];

/** [table, constraint name, column, referenced table, referenced column] */
const FOREIGN_KEYS: Array<[string, string, string, string, string]> = [
  ['refresh_tokens', 'refresh_tokens_user_id_fkey', 'user_id', 'users', 'id'],
  ['files', 'files_uploaded_by_fkey', 'uploaded_by', 'users', 'id'],
  ['customers', 'customers_cnic_file_id_fkey', 'cnic_file_id', 'files', 'id'],
  [
    'guarantors',
    'guarantors_customer_id_fkey',
    'customer_id',
    'customers',
    'id',
  ],
  ['guarantors', 'guarantors_cnic_file_id_fkey', 'cnic_file_id', 'files', 'id'],
  [
    'products',
    'products_category_id_fkey',
    'category_id',
    'product_categories',
    'id',
  ],
  ['contracts', 'contracts_customer_id_fkey', 'customer_id', 'customers', 'id'],
  ['contracts', 'contracts_product_id_fkey', 'product_id', 'products', 'id'],
  [
    'installments',
    'installments_contract_id_fkey',
    'contract_id',
    'contracts',
    'id',
  ],
  ['payments', 'payments_contract_id_fkey', 'contract_id', 'contracts', 'id'],
  ['payments', 'payments_recorded_by_fkey', 'recorded_by', 'users', 'id'],
  [
    'ledger_snapshots',
    'ledger_snapshots_contract_id_fkey',
    'contract_id',
    'contracts',
    'id',
  ],
  [
    'ledger_snapshots',
    'ledger_snapshots_pdf_file_id_fkey',
    'pdf_file_id',
    'files',
    'id',
  ],
  [
    'ledger_snapshots',
    'ledger_snapshots_created_by_fkey',
    'created_by',
    'users',
    'id',
  ],
  [
    'capital_entries',
    'capital_entries_entered_by_fkey',
    'entered_by',
    'users',
    'id',
  ],
  [
    'expense_entries',
    'expense_entries_entered_by_fkey',
    'entered_by',
    'users',
    'id',
  ],
  [
    'summary_scenarios',
    'summary_scenarios_user_id_fkey',
    'user_id',
    'users',
    'id',
  ],
  ['audit_logs', 'audit_logs_actor_id_fkey', 'actor_id', 'users', 'id'],
];

export class Baseline1755500000000 implements MigrationInterface {
  name = 'Baseline1755500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Every statement below names its tables unqualified, and TypeORM does NOT
    // set search_path from the `schema` option — it only qualifies its own
    // entity queries. Without this, `customers` resolves through the role's
    // default search_path (`"$user", public`) and the migration reads or
    // creates the wrong tables entirely. SET LOCAL is scoped to the migration's
    // transaction, so it cannot leak into the pool.
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    // CREATE TYPE has no IF NOT EXISTS, so the duplicate is caught instead.
    for (const { name, values } of ENUM_TYPES) {
      const literals = values.map((value) => `'${value}'`).join(', ');

      await queryRunner.query(
        `DO $$ BEGIN
           CREATE TYPE "${name}" AS ENUM (${literals});
         EXCEPTION WHEN duplicate_object THEN NULL;
         END $$;`,
      );
    }

    for (const statement of TABLES) {
      await queryRunner.query(statement);
    }

    for (const statement of INDEXES) {
      await queryRunner.query(statement);
    }

    for (const table of UPDATED_AT_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}"
           ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP`,
      );
    }

    // Same story as CREATE TYPE: ADD CONSTRAINT has no IF NOT EXISTS.
    for (const [
      table,
      constraint,
      column,
      refTable,
      refColumn,
    ] of FOREIGN_KEYS) {
      await queryRunner.query(
        `DO $$ BEGIN
           ALTER TABLE "${table}"
             ADD CONSTRAINT "${constraint}"
             FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}")
             ON DELETE RESTRICT ON UPDATE CASCADE;
         EXCEPTION WHEN duplicate_object THEN NULL;
         END $$;`,
      );
    }
  }

  public down(): Promise<void> {
    // Reverting the baseline means dropping every table in the application,
    // which is not something a mistyped command should be able to do. Restore
    // from a backup instead.
    return Promise.reject(
      new Error(
        'The baseline migration cannot be reverted. Restore from a database backup.',
      ),
    );
  }
}
