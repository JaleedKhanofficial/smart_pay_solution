import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every primary key becomes a sequential integer, so a record can be quoted as
 * "customer 7" rather than read out as a UUID. `customers` and `guarantors`
 * already worked this way; this brings the rest of SRS §5 in line.
 *
 * Two keys are deliberately left alone:
 *   - `files.id` is the filename (SRS §2.7 deviation 2), which is the whole
 *     point of that decision — an opaque number would undo it;
 *   - `settings.key` is a name, not an identifier.
 *
 * `refresh_tokens.family_id` also stays a UUID. It groups a rotation chain for
 * reuse detection; nobody quotes it, and a guessable one would weaken the check.
 */

/** Empty today, so the key is simply rebuilt rather than renumbered. */
const EMPTY_TABLES = [
  'installments',
  'payments',
  'ledger_snapshots',
  'capital_entries',
  'expense_entries',
  'summary_scenarios',
  'contracts',
  'products',
];

/** [table, column] pairs pointing at users.id, rewritten in place. */
const USER_REFERENCES: Array<[string, string]> = [
  ['refresh_tokens', 'user_id'],
  ['files', 'uploaded_by'],
  ['payments', 'recorded_by'],
  ['ledger_snapshots', 'created_by'],
  ['capital_entries', 'entered_by'],
  ['expense_entries', 'entered_by'],
  ['summary_scenarios', 'user_id'],
  ['audit_logs', 'actor_id'],
];

export class IntegerIds1755600000000 implements MigrationInterface {
  name = 'IntegerIds1755600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Same reason as the baseline: TypeORM does not set search_path, so raw
    // SQL would otherwise resolve against the role's default schema.
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    const run = (sql: string) => queryRunner.query(sql);

    // ---------------------------------------------------------------------
    // 1. Sessions. Every access token carries the user id in its `sub` claim,
    //    so all of these die the moment users.id changes type — renumbering
    //    them would preserve nothing. Everyone signs in again.
    // ---------------------------------------------------------------------
    await run(`DELETE FROM "refresh_tokens"`);

    await run(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_fkey"`,
    );
    await run(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_pkey"`,
    );
    await run(`ALTER TABLE "refresh_tokens" DROP COLUMN "id"`);
    await run(`ALTER TABLE "refresh_tokens" ADD COLUMN "id" SERIAL`);
    await run(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")`,
    );

    // ---------------------------------------------------------------------
    // 2. Tables with no rows yet: drop the key and its referencing columns and
    //    rebuild them as integers. Nothing to carry across.
    // ---------------------------------------------------------------------
    for (const [table, column] of USER_REFERENCES) {
      await run(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${table}_${column}_fkey"`,
      );
    }

    await run(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_category_id_fkey"`,
    );
    await run(
      `ALTER TABLE "contracts" DROP CONSTRAINT IF EXISTS "contracts_product_id_fkey"`,
    );
    await run(
      `ALTER TABLE "installments" DROP CONSTRAINT IF EXISTS "installments_contract_id_fkey"`,
    );
    await run(
      `ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_contract_id_fkey"`,
    );
    await run(
      `ALTER TABLE "ledger_snapshots" DROP CONSTRAINT IF EXISTS "ledger_snapshots_contract_id_fkey"`,
    );

    for (const table of EMPTY_TABLES) {
      await run(`ALTER TABLE "${table}" DROP CONSTRAINT "${table}_pkey"`);
      await run(`ALTER TABLE "${table}" DROP COLUMN "id"`);
      await run(`ALTER TABLE "${table}" ADD COLUMN "id" SERIAL`);
      await run(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_pkey" PRIMARY KEY ("id")`,
      );
    }

    // Referencing columns on those same empty tables.
    for (const [table, column] of [
      ['products', 'category_id'],
      ['contracts', 'product_id'],
      ['installments', 'contract_id'],
      ['payments', 'contract_id'],
      ['ledger_snapshots', 'contract_id'],
      ['payments', 'recorded_by'],
      ['ledger_snapshots', 'created_by'],
      ['capital_entries', 'entered_by'],
      ['expense_entries', 'entered_by'],
      ['summary_scenarios', 'user_id'],
    ] as Array<[string, string]>) {
      await run(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
      await run(
        `ALTER TABLE "${table}" ADD COLUMN "${column}" INTEGER NOT NULL`,
      );
    }

    // ---------------------------------------------------------------------
    // 3. product_categories — one row, referenced only by the empty products
    //    table, so the key can be rebuilt without remapping anything.
    // ---------------------------------------------------------------------
    await run(
      `ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_pkey"`,
    );
    await run(`ALTER TABLE "product_categories" DROP COLUMN "id"`);
    await run(`ALTER TABLE "product_categories" ADD COLUMN "id" SERIAL`);
    await run(
      `ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")`,
    );

    // ---------------------------------------------------------------------
    // 4. audit_logs — 350+ rows that must survive (FR-AUD-03, append-only).
    //    Numbered by creation order so the sequence reads as a timeline.
    //    actor_id is remapped in step 5, once users has its new key.
    // ---------------------------------------------------------------------
    await run(`ALTER TABLE "audit_logs" ADD COLUMN "new_id" SERIAL`);
    await run(`
      WITH ordered AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
        FROM "audit_logs"
      )
      UPDATE "audit_logs" a SET "new_id" = o.rn FROM ordered o WHERE a."id" = o."id"`);
    await run(`
      SELECT setval(
        pg_get_serial_sequence('audit_logs', 'new_id'),
        COALESCE((SELECT MAX("new_id") FROM "audit_logs"), 0) + 1,
        false)`);
    await run(`ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_pkey"`);
    await run(`ALTER TABLE "audit_logs" DROP COLUMN "id"`);
    await run(`ALTER TABLE "audit_logs" RENAME COLUMN "new_id" TO "id"`);
    await run(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")`,
    );
    await run(
      `ALTER SEQUENCE "audit_logs_new_id_seq" RENAME TO "audit_logs_id_seq"`,
    );

    // ---------------------------------------------------------------------
    // 5. users — the one conversion that has live references to carry across.
    //    files.uploaded_by and audit_logs.actor_id both hold real data.
    // ---------------------------------------------------------------------
    await run(`ALTER TABLE "users" ADD COLUMN "new_id" SERIAL`);
    await run(`
      WITH ordered AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
        FROM "users"
      )
      UPDATE "users" u SET "new_id" = o.rn FROM ordered o WHERE u."id" = o."id"`);
    await run(`
      SELECT setval(
        pg_get_serial_sequence('users', 'new_id'),
        COALESCE((SELECT MAX("new_id") FROM "users"), 0) + 1,
        false)`);

    // files.uploaded_by is NOT NULL, so the new column is filled before the
    // constraint goes back on.
    await run(`ALTER TABLE "files" ADD COLUMN "new_uploaded_by" INTEGER`);
    await run(`
      UPDATE "files" f SET "new_uploaded_by" = u."new_id"
      FROM "users" u WHERE f."uploaded_by" = u."id"`);
    await run(`ALTER TABLE "files" DROP COLUMN "uploaded_by"`);
    await run(
      `ALTER TABLE "files" RENAME COLUMN "new_uploaded_by" TO "uploaded_by"`,
    );
    await run(`ALTER TABLE "files" ALTER COLUMN "uploaded_by" SET NOT NULL`);

    // audit_logs.actor_id is nullable: a failed login has no actor.
    await run(`ALTER TABLE "audit_logs" ADD COLUMN "new_actor_id" INTEGER`);
    await run(`
      UPDATE "audit_logs" a SET "new_actor_id" = u."new_id"
      FROM "users" u WHERE a."actor_id" = u."id"`);
    await run(`DROP INDEX IF EXISTS "audit_logs_actor_id_idx"`);
    await run(`ALTER TABLE "audit_logs" DROP COLUMN "actor_id"`);
    await run(
      `ALTER TABLE "audit_logs" RENAME COLUMN "new_actor_id" TO "actor_id"`,
    );

    // refresh_tokens.user_id is NOT NULL but the table was emptied in step 1.
    await run(`ALTER TABLE "refresh_tokens" DROP COLUMN "user_id"`);
    await run(
      `ALTER TABLE "refresh_tokens" ADD COLUMN "user_id" INTEGER NOT NULL`,
    );

    await run(`DROP INDEX IF EXISTS "uq_users_email_live"`);
    await run(`ALTER TABLE "users" DROP CONSTRAINT "users_pkey"`);
    await run(`ALTER TABLE "users" DROP COLUMN "id"`);
    await run(`ALTER TABLE "users" RENAME COLUMN "new_id" TO "id"`);
    await run(
      `ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id")`,
    );
    await run(`ALTER SEQUENCE "users_new_id_seq" RENAME TO "users_id_seq"`);

    // ---------------------------------------------------------------------
    // 6. Put the indexes and foreign keys back.
    // ---------------------------------------------------------------------
    await run(`
      CREATE UNIQUE INDEX "uq_users_email_live"
        ON "users"("email") WHERE "deleted_at" IS NULL`);
    await run(
      `CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id")`,
    );
    await run(
      `CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id")`,
    );

    for (const [table, column] of USER_REFERENCES) {
      await run(`
        ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_fkey"
          FOREIGN KEY ("${column}") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    for (const [table, column, target] of [
      ['products', 'category_id', 'product_categories'],
      ['contracts', 'product_id', 'products'],
      ['installments', 'contract_id', 'contracts'],
      ['payments', 'contract_id', 'contracts'],
      ['ledger_snapshots', 'contract_id', 'contracts'],
    ] as Array<[string, string, string]>) {
      await run(`
        ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_fkey"
          FOREIGN KEY ("${column}") REFERENCES "${target}"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE`);
    }
  }

  public down(): Promise<void> {
    // The old UUIDs are gone once this has run; there is nothing to restore
    // them from. Recover from a backup instead.
    return Promise.reject(
      new Error(
        'IntegerIds cannot be reverted — the original UUIDs are not retained. Restore from a database backup.',
      ),
    );
  }
}
