import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `files.id` becomes a sequential integer, and a file records who it belongs to
 * (`customer_id`, `guarantor_id`) instead of being reached only through the
 * owner's column.
 *
 * This reverses SRS §2.7 deviation 2, where the filename was the key. The name
 * is not lost — it moves into `stored_name`, so it is still readable, just no
 * longer the identifier.
 *
 * The foreign keys between `files` and its owners are **dropped**, not
 * recreated, at the owner's request. The consequence is worth stating plainly:
 * the database will no longer refuse a file id that does not exist, nor stop a
 * file being deleted while a customer still points at it. This departs from
 * SRS NFR-05 / §5, so both are amended.
 *
 * Data-preserving: every file keeps its bytes, its path and its name, and every
 * reference is rewritten to the new key inside one transaction.
 */

/** [table, column] pairs holding a file id, rewritten from text to integer. */
const FILE_REFERENCES: Array<[string, string]> = [
  ['customers', 'cnic_file_front_id'],
  ['customers', 'cnic_file_back_id'],
  ['guarantors', 'cnic_file_front_id'],
  ['guarantors', 'cnic_file_back_id'],
  ['ledger_snapshots', 'pdf_file_id'],
];

const DROPPED_CONSTRAINTS = [
  ['customers', 'customers_cnic_file_front_id_fkey'],
  ['customers', 'customers_cnic_file_back_id_fkey'],
  ['guarantors', 'guarantors_cnic_file_front_id_fkey'],
  ['guarantors', 'guarantors_cnic_file_back_id_fkey'],
  ['ledger_snapshots', 'ledger_snapshots_pdf_file_id_fkey'],
];

export class FileIntegerIds1756000000000 implements MigrationInterface {
  name = 'FileIntegerIds1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    const run = (sql: string) => queryRunner.query(sql);

    // 1. The references stop being foreign keys, so the constraints go first —
    //    nothing below would be possible while they hold.
    for (const [table, constraint] of DROPPED_CONSTRAINTS) {
      await run(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint}"`,
      );
    }

    // 2. Keep the filename as data before it stops being the key.
    await run(
      `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "stored_name" TEXT`,
    );
    await run(
      `UPDATE "files" SET "stored_name" = "id" WHERE "stored_name" IS NULL`,
    );
    await run(`ALTER TABLE "files" ALTER COLUMN "stored_name" SET NOT NULL`);

    // 3. The new key, numbered by upload order so ids read as a timeline.
    await run(`ALTER TABLE "files" ADD COLUMN "new_id" SERIAL`);
    await run(`
      WITH ordered AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
        FROM "files"
      )
      UPDATE "files" f SET "new_id" = o.rn FROM ordered o WHERE f."id" = o."id"`);
    await run(`
      SELECT setval(
        pg_get_serial_sequence('files', 'new_id'),
        COALESCE((SELECT MAX("new_id") FROM "files"), 0) + 1,
        false)`);

    // 4. Owner columns, filled from the references that still point by name.
    //    This has to happen before step 5 rewrites those columns.
    await run(
      `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "customer_id" INTEGER`,
    );
    await run(
      `ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "guarantor_id" INTEGER`,
    );

    await run(`
      UPDATE "files" f SET "customer_id" = c."id"
        FROM "customers" c
       WHERE f."id" IN (c."cnic_file_front_id", c."cnic_file_back_id")`);

    // A guarantor's scan records the guarantor and the customer behind them.
    await run(`
      UPDATE "files" f SET "guarantor_id" = g."id", "customer_id" = g."customer_id"
        FROM "guarantors" g
       WHERE f."id" IN (g."cnic_file_front_id", g."cnic_file_back_id")`);

    // 5. Rewrite every reference from the filename to the new integer key.
    for (const [table, column] of FILE_REFERENCES) {
      await run(`ALTER TABLE "${table}" ADD COLUMN "new_ref" INTEGER`);
      await run(`
        UPDATE "${table}" t SET "new_ref" = f."new_id"
          FROM "files" f WHERE t."${column}" = f."id"`);
      await run(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
      await run(
        `ALTER TABLE "${table}" RENAME COLUMN "new_ref" TO "${column}"`,
      );
    }

    // 6. Swap the key itself.
    await run(`ALTER TABLE "files" DROP CONSTRAINT "files_pkey"`);
    await run(`ALTER TABLE "files" DROP COLUMN "id"`);
    await run(`ALTER TABLE "files" RENAME COLUMN "new_id" TO "id"`);
    await run(
      `ALTER TABLE "files" ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id")`,
    );
    await run(`ALTER SEQUENCE "files_new_id_seq" RENAME TO "files_id_seq"`);

    // 7. The owner columns are what "every image for customer 7" reads.
    await run(
      `CREATE INDEX IF NOT EXISTS "files_customer_id_idx" ON "files"("customer_id")`,
    );
    await run(
      `CREATE INDEX IF NOT EXISTS "files_guarantor_id_idx" ON "files"("guarantor_id")`,
    );
  }

  public down(): Promise<void> {
    // The filenames survive in stored_name, but the old key and every
    // reference to it are gone. Rebuilding them is a restore, not a revert.
    return Promise.reject(
      new Error(
        'FileIntegerIds cannot be reverted — the filename keys and their references are replaced. Restore from a database backup.',
      ),
    );
  }
}
