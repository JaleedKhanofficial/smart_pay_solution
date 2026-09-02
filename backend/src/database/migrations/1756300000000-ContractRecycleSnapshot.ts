import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractRecycleSnapshot1756300000000
  implements MigrationInterface
{
  name = 'ContractRecycleSnapshot1756300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_recycle_snapshots" (
        "contract_id" INTEGER NOT NULL,
        "snapshot" JSONB NOT NULL,
        "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contract_recycle_snapshots_pkey" PRIMARY KEY ("contract_id"),
        CONSTRAINT "contract_recycle_snapshots_contract_id_fkey"
          FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "contract_recycle_snapshots"`,
    );
  }
}
