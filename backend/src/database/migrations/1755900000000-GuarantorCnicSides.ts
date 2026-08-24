import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives a guarantor the same two CNIC scans the customer has: renames
 * `cnic_file_id` to `cnic_file_front_id` and adds `cnic_file_back_id`.
 *
 * The rename carries every stored image across untouched — it is a column
 * rename, not a copy — and the new column is nullable, so existing guarantors
 * simply have no back scan yet.
 */
export class GuarantorCnicSides1755900000000 implements MigrationInterface {
  name = 'GuarantorCnicSides1755900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM does not set search_path from the `schema` option, so raw SQL has
    // to be pinned or it resolves against the role's default schema.
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    // Guarded so re-running against an already-renamed database is harmless.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = 'guarantors'
             AND column_name = 'cnic_file_id'
        ) THEN
          ALTER TABLE "guarantors" RENAME COLUMN "cnic_file_id" TO "cnic_file_front_id";
        END IF;
      END $$;`);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'guarantors_cnic_file_id_fkey'
        ) THEN
          ALTER TABLE "guarantors"
            RENAME CONSTRAINT "guarantors_cnic_file_id_fkey"
            TO "guarantors_cnic_file_front_id_fkey";
        END IF;
      END $$;`);

    await queryRunner.query(
      `ALTER TABLE "guarantors" ADD COLUMN IF NOT EXISTS "cnic_file_back_id" TEXT`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "guarantors"
          ADD CONSTRAINT "guarantors_cnic_file_back_id_fkey"
          FOREIGN KEY ("cnic_file_back_id") REFERENCES "files"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;`);
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'GuarantorCnicSides cannot be reverted — dropping the back column would orphan every back-side image. Restore from a database backup.',
      ),
    );
  }
}
