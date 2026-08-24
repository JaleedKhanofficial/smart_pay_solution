import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the customer's CNIC image column to say which side it holds, now
 * that there is a back one beside it: `cnic_file_id` → `cnic_file_front_id`.
 *
 * A rename, not a new column — the values, and therefore every stored image,
 * are carried across untouched. `guarantors.cnic_file_id` is deliberately left
 * alone: a guarantor has one scan, so naming it "front" would imply a back
 * that does not exist.
 */
export class CustomerCnicFront1755800000000 implements MigrationInterface {
  name = 'CustomerCnicFront1755800000000';

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
             AND table_name = 'customers'
             AND column_name = 'cnic_file_id'
        ) THEN
          ALTER TABLE "customers" RENAME COLUMN "cnic_file_id" TO "cnic_file_front_id";
        END IF;
      END $$;`);

    // The foreign key survives a column rename, but its name would still read
    // `..._cnic_file_id_fkey`, which is the sort of thing that misleads later.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conname = 'customers_cnic_file_id_fkey'
        ) THEN
          ALTER TABLE "customers"
            RENAME CONSTRAINT "customers_cnic_file_id_fkey"
            TO "customers_cnic_file_front_id_fkey";
        END IF;
      END $$;`);
  }

  public down(): Promise<void> {
    // Reversible in principle, but the application no longer knows the old
    // name, so reverting the column without reverting the code breaks reads.
    return Promise.reject(
      new Error(
        'CustomerCnicFront cannot be reverted independently of the code. Restore from a database backup.',
      ),
    );
  }
}
