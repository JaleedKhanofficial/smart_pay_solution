import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SRS v2.6 amendment §M and §U step 1: the schema Module 13 (Investor Capital)
 * needs, plus `contracts.cost_price`, which Module 4 must carry from its first
 * day — funding attaches at activation and cannot be retrofitted without
 * hand-allocating every live contract.
 *
 * Additive. `contracts`, `capital_entries` and `ledger_snapshots` are all empty,
 * so nothing is rewritten and no figure moves.
 *
 * House style applied over the amendment's text: sequential integer keys
 * (§2.7 item 1) rather than the UUIDs it describes, and `DEFAULT
 * CURRENT_TIMESTAMP` on the timestamps (§2.8.7).
 */

const ENUM_TYPES: Array<{ name: string; values: string[] }> = [
  { name: 'InvestorStatus', values: ['active', 'inactive'] },
  {
    name: 'InvestorTxnType',
    values: ['Deposit', 'Withdrawal', 'Adjustment', 'Loss'],
  },
  { name: 'InvestorBucket', values: ['principal', 'profit'] },
  // One value on purpose (§5.11): a second source cannot appear without a
  // migration, and therefore without a decision about BR-25.
  { name: 'CapitalSource', values: ['own'] },
  { name: 'SnapshotKind', values: ['recovery', 'investor'] },
];

/** The settings block from §L, seeded only where the key is not already set. */
const SETTINGS: Array<[string, string]> = [
  ['default_profit_share_pct', '50.00'],
  ['auto_allocate_funding', 'true'],
  ['deployment_source', '"profit_first"'],
  ['withdrawal_source', '"profit_first"'],
  ['allow_investor_overdraw', 'false'],
];

export class InvestorCapital1756100000000 implements MigrationInterface {
  name = 'InvestorCapital1756100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    const run = (sql: string) => queryRunner.query(sql);

    // CREATE TYPE has no IF NOT EXISTS, so the duplicate is caught instead.
    for (const { name, values } of ENUM_TYPES) {
      const literals = values.map((value) => `'${value}'`).join(', ');

      await run(`DO $$ BEGIN
         CREATE TYPE "${name}" AS ENUM (${literals});
       EXCEPTION WHEN duplicate_object THEN NULL;
       END $$;`);
    }

    // ---------------------------------------------------------------- 5.7 --
    // Capital deployed is measured against what the business paid, not what it
    // charged. Existing rows take cost = sale, which is what M-10 assumes for
    // migrated v1 contracts.
    await run(
      `ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(12,2)`,
    );
    await run(
      `UPDATE "contracts" SET "cost_price" = "sale_price" WHERE "cost_price" IS NULL`,
    );
    await run(`ALTER TABLE "contracts" ALTER COLUMN "cost_price" SET NOT NULL`);
    await run(`DO $$ BEGIN
       ALTER TABLE "contracts" ADD CONSTRAINT "contracts_cost_price_check"
         CHECK ("cost_price" > 0 AND "cost_price" <= "sale_price");
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$;`);

    // --------------------------------------------------------------- 5.11 --
    // FR-SUM-10: investor money is never a capital entry. Marking the source
    // is what stops BR-25 counting borrowed money as owner equity.
    await run(
      `ALTER TABLE "capital_entries" ADD COLUMN IF NOT EXISTS "source" "CapitalSource" NOT NULL DEFAULT 'own'`,
    );

    // --------------------------------------------------------------- 5.16 --
    await run(`CREATE TABLE IF NOT EXISTS "investors" (
      "id" SERIAL NOT NULL,
      "full_name" VARCHAR(150) NOT NULL,
      "father_husband_name" VARCHAR(150) NOT NULL,
      "cnic_number" VARCHAR(15) NOT NULL,
      "mobile_number" VARCHAR(20) NOT NULL,
      "address" TEXT NOT NULL,
      "email" VARCHAR(190),
      "profit_share_pct" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
      "loss_participation" BOOLEAN NOT NULL DEFAULT true,
      "agreement_date" DATE,
      "status" "InvestorStatus" NOT NULL DEFAULT 'active',
      "notes" TEXT,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "investors_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "investors_profit_share_pct_check"
        CHECK ("profit_share_pct" >= 0 AND "profit_share_pct" <= 100)
    )`);

    await run(
      `CREATE INDEX IF NOT EXISTS "investors_full_name_idx" ON "investors"("full_name")`,
    );
    // Same rule as customers (FR-CUS-08): unique among live rows only, so a
    // soft-deleted investor never blocks reuse of their CNIC.
    await run(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_investors_cnic_live" ON "investors"("cnic_number") WHERE "deleted_at" IS NULL`,
    );

    // --------------------------------------------------------------- 5.17 --
    // Append-only (FR-IVT-07/08): no deleted_at, no updated_at, and nothing but
    // Deposit, Withdrawal and Adjustment is ever hand-entered. A mistake is
    // corrected by a reversing Adjustment, never by editing the original.
    await run(`CREATE TABLE IF NOT EXISTS "investor_transactions" (
      "id" SERIAL NOT NULL,
      "investor_id" INTEGER NOT NULL,
      "type" "InvestorTxnType" NOT NULL,
      "bucket" "InvestorBucket" NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL,
      "txn_date" DATE NOT NULL,
      "method" "PaymentMethod",
      "reference" TEXT,
      "contract_id" INTEGER,
      "reason" TEXT,
      "entered_by" INTEGER NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "investor_transactions_pkey" PRIMARY KEY ("id"),
      -- Only an Adjustment may be negative; it is how a reversal is written.
      CONSTRAINT "investor_transactions_amount_check"
        CHECK ("amount" <> 0 AND ("type" = 'Adjustment' OR "amount" > 0)),
      -- Adjustment and Loss carry a reason and no method; the two cash types
      -- carry a method.
      CONSTRAINT "investor_transactions_reason_check"
        CHECK ("type" NOT IN ('Adjustment', 'Loss')
               OR ("reason" IS NOT NULL AND "method" IS NULL)),
      CONSTRAINT "investor_transactions_method_check"
        CHECK ("type" IN ('Adjustment', 'Loss') OR "method" IS NOT NULL)
    )`);

    await run(
      `CREATE INDEX IF NOT EXISTS "investor_transactions_investor_id_idx" ON "investor_transactions"("investor_id")`,
    );
    await run(
      `CREATE INDEX IF NOT EXISTS "investor_transactions_txn_date_idx" ON "investor_transactions"("txn_date")`,
    );

    // --------------------------------------------------------------- 5.18 --
    // The profit share is snapshotted here, not read from the investor, so
    // changing a standing rate never restates a deal already funded (BR-16).
    await run(`CREATE TABLE IF NOT EXISTS "contract_fundings" (
      "id" SERIAL NOT NULL,
      "contract_id" INTEGER NOT NULL,
      "investor_id" INTEGER NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL,
      "share_pct" DECIMAL(5,2) NOT NULL,
      "profit_share_pct" DECIMAL(5,2) NOT NULL,
      "funded_from_principal" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "funded_from_profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "share_override_reason" TEXT,
      "funded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "created_by" INTEGER NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "contract_fundings_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "contract_fundings_amount_check" CHECK ("amount" > 0),
      CONSTRAINT "contract_fundings_share_pct_check"
        CHECK ("share_pct" > 0 AND "share_pct" <= 100),
      CONSTRAINT "contract_fundings_profit_share_pct_check"
        CHECK ("profit_share_pct" >= 0 AND "profit_share_pct" <= 100),
      -- BR-22: the bucket split is what BR-19 reverses on recovery, so it must
      -- account for the whole deployment.
      CONSTRAINT "contract_fundings_bucket_split_check"
        CHECK ("funded_from_principal" + "funded_from_profit" = "amount")
    )`);

    await run(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_fundings_contract_investor" ON "contract_fundings"("contract_id", "investor_id")`,
    );
    await run(
      `CREATE INDEX IF NOT EXISTS "contract_fundings_investor_id_idx" ON "contract_fundings"("investor_id")`,
    );

    // --------------------------------------------------------------- 5.10 --
    // A snapshot now belongs either to a contract's recovery ledger or to an
    // investor statement, never both.
    await run(
      `ALTER TABLE "ledger_snapshots" ADD COLUMN IF NOT EXISTS "kind" "SnapshotKind" NOT NULL DEFAULT 'recovery'`,
    );
    await run(
      `ALTER TABLE "ledger_snapshots" ADD COLUMN IF NOT EXISTS "investor_id" INTEGER`,
    );
    await run(
      `ALTER TABLE "ledger_snapshots" ALTER COLUMN "contract_id" DROP NOT NULL`,
    );
    await run(`DO $$ BEGIN
       ALTER TABLE "ledger_snapshots" ADD CONSTRAINT "ledger_snapshots_owner_check"
         CHECK (("contract_id" IS NULL) <> ("investor_id" IS NULL));
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$;`);

    // ------------------------------------------------------------------ FK --
    // Investor relationships keep their foreign keys; only the file-ownership
    // columns were exempted (§2.7 item 12).
    for (const [table, column, target] of [
      ['investor_transactions', 'investor_id', 'investors'],
      ['investor_transactions', 'contract_id', 'contracts'],
      ['investor_transactions', 'entered_by', 'users'],
      ['contract_fundings', 'contract_id', 'contracts'],
      ['contract_fundings', 'investor_id', 'investors'],
      ['contract_fundings', 'created_by', 'users'],
      ['ledger_snapshots', 'investor_id', 'investors'],
    ] as Array<[string, string, string]>) {
      await run(`DO $$ BEGIN
         ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_fkey"
           FOREIGN KEY ("${column}") REFERENCES "${target}"("id")
           ON DELETE RESTRICT ON UPDATE CASCADE;
       EXCEPTION WHEN duplicate_object THEN NULL;
       END $$;`);
    }

    // -------------------------------------------------------------- §L ----
    // Seeded, not overwritten: a value already tuned by an admin stands.
    for (const [key, value] of SETTINGS) {
      await run(`INSERT INTO "settings" ("key", "value", "updated_at")
         VALUES ('${key}', '${value}'::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT ("key") DO NOTHING`);
    }
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'InvestorCapital cannot be reverted — dropping the investor tables would discard every deposit and funding row. Restore from a database backup.',
      ),
    );
  }
}
