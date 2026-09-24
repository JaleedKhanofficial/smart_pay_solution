import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Module 15 (SRS §4.15): what the business spends, and who carries it.
 *
 * Three tables. `expense_periods` exists because the investor roster changes —
 * a pot raised while six people were in must stay divided by those six, not by
 * however many are on the books when someone opens the report next year.
 * `expense_period_members` is what pins that, and carries the waiver.
 *
 * The old `expense_entries` table goes: it held the same kind of record with
 * nowhere to say whose cost it was, and the Summary Report's Expenses card
 * that read it has been removed. Its rows are copied across as common
 * expenses so nothing recorded is lost.
 */
export class Expenses1756400000000 implements MigrationInterface {
  name = 'Expenses1756400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expense_periods" (
        "id" SERIAL PRIMARY KEY,
        "label" VARCHAR(60) NOT NULL,
        "starts_on" DATE NOT NULL,
        "ends_on" DATE,
        "closed" BOOLEAN NOT NULL DEFAULT FALSE,
        "note" TEXT,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "expense_periods_created_by_fkey"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "expense_periods_dates_check"
          CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expense_period_members" (
        "id" SERIAL PRIMARY KEY,
        "period_id" INTEGER NOT NULL,
        "investor_id" INTEGER NOT NULL,
        "waived" BOOLEAN NOT NULL DEFAULT FALSE,
        "waive_reason" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "expense_period_members_period_id_fkey"
          FOREIGN KEY ("period_id") REFERENCES "expense_periods"("id")
          ON DELETE CASCADE,
        CONSTRAINT "expense_period_members_investor_id_fkey"
          FOREIGN KEY ("investor_id") REFERENCES "investors"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "expense_period_members_unique"
          UNIQUE ("period_id", "investor_id"),
        -- BR-29: a waiver without a reason is an unexplained bill somebody
        -- else ends up carrying.
        CONSTRAINT "expense_period_members_waive_reason_check"
          CHECK ("waived" = FALSE OR "waive_reason" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" SERIAL PRIMARY KEY,
        "kind" VARCHAR(12) NOT NULL,
        "period_id" INTEGER,
        "investor_id" INTEGER,
        "spent_on" DATE NOT NULL,
        "description" VARCHAR(200) NOT NULL,
        "amount" NUMERIC(12,2) NOT NULL,
        "remarks" TEXT,
        "entered_by" INTEGER NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "expenses_period_id_fkey"
          FOREIGN KEY ("period_id") REFERENCES "expense_periods"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "expenses_investor_id_fkey"
          FOREIGN KEY ("investor_id") REFERENCES "investors"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "expenses_entered_by_fkey"
          FOREIGN KEY ("entered_by") REFERENCES "users"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "expenses_amount_check" CHECK ("amount" > 0),
        -- The kind decides which column must be filled. A common expense
        -- belongs to a period and to nobody in particular; an individual one
        -- belongs to a person and to no period.
        CONSTRAINT "expenses_kind_check" CHECK (
          ("kind" = 'common'
             AND "period_id" IS NOT NULL AND "investor_id" IS NULL)
          OR
          ("kind" = 'individual'
             AND "investor_id" IS NOT NULL AND "period_id" IS NULL)
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "expenses_period_id_idx" ON "expenses" ("period_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "expenses_investor_id_idx" ON "expenses" ("investor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "expenses_spent_on_idx" ON "expenses" ("spent_on")`,
    );

    /**
     * Carry the old entries across rather than drop them.
     *
     * They land in a period of their own, dated by the earliest entry, with no
     * members — so they are recorded and visible but charged to nobody until
     * someone adds members to that period and decides who carried them.
     */
    const existing: unknown = await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM "expense_entries" WHERE "deleted_at" IS NULL`,
    );

    const carried = Array.isArray(existing)
      ? Number((existing[0] as { count?: string })?.count ?? 0)
      : 0;

    if (carried > 0) {
      await queryRunner.query(`
        INSERT INTO "expense_periods"
          ("label", "starts_on", "closed", "note", "created_by")
        SELECT
          'Carried forward',
          COALESCE(MIN("created_at")::date, CURRENT_DATE),
          TRUE,
          'Moved from the Summary Report''s expense list. No members, so these are charged to nobody until someone says who carried them.',
          MIN("entered_by")
        FROM "expense_entries"
        WHERE "deleted_at" IS NULL
      `);

      await queryRunner.query(`
        INSERT INTO "expenses"
          ("kind", "period_id", "spent_on", "description", "amount",
           "remarks", "entered_by", "created_at")
        SELECT
          'common',
          (SELECT "id" FROM "expense_periods" WHERE "label" = 'Carried forward'),
          "created_at"::date,
          COALESCE(NULLIF(TRIM("note"), ''), 'Expense ' || "period_label"),
          "amount",
          'Period label was "' || "period_label" || '"',
          "entered_by",
          "created_at"
        FROM "expense_entries"
        WHERE "deleted_at" IS NULL
      `);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "expense_entries"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expense_entries" (
        "id" SERIAL PRIMARY KEY,
        "amount" NUMERIC(12,2) NOT NULL,
        "period_label" VARCHAR(20) NOT NULL,
        "note" TEXT,
        "entered_by" INTEGER NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "expense_entries_entered_by_fkey"
          FOREIGN KEY ("entered_by") REFERENCES "users"("id")
          ON DELETE RESTRICT
      )
    `);

    // Common expenses go back as plain entries; individual ones had no home
    // in the old table and are dropped with it.
    await queryRunner.query(`
      INSERT INTO "expense_entries"
        ("amount", "period_label", "note", "entered_by", "created_at")
      SELECT "amount", TO_CHAR("spent_on", 'YYYY-MM'), "description",
             "entered_by", "created_at"
      FROM "expenses"
      WHERE "kind" = 'common' AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expense_period_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expense_periods"`);
  }
}
