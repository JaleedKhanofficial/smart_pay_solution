import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the back side of the customer's CNIC (FR-CUS-04-v2), alongside the
 * existing front image.
 *
 * Additive only: the column is nullable, so every existing customer keeps its
 * front image and simply has no back one. No row is rewritten.
 */
export class CustomerCnicBack1755700000000 implements MigrationInterface {
  name = 'CustomerCnicBack1755700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM does not set search_path from the `schema` option — it only
    // qualifies its own entity queries — so raw SQL has to be pinned or it
    // resolves against the role's default schema and hits the wrong table.
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cnic_file_back_id" TEXT`,
    );

    // ADD CONSTRAINT has no IF NOT EXISTS, so the duplicate is caught instead.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "customers"
          ADD CONSTRAINT "customers_cnic_file_back_id_fkey"
          FOREIGN KEY ("cnic_file_back_id") REFERENCES "files"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;`);
  }

  public down(): Promise<void> {
    // Dropping the column would discard every back scan on file, and the images
    // it points at would be orphaned on disk with nothing referencing them.
    return Promise.reject(
      new Error(
        'CustomerCnicBack cannot be reverted — dropping the column would orphan every back-side image. Restore from a database backup.',
      ),
    );
  }
}
