import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops investor profit-sharing: the standing rate on `investors`, the
 * per-deal snapshot on `contract_fundings`, and the retired setting.
 *
 * Investors still recover deployed capital; markup profit stays with the house.
 */
export class RemoveProfitShare1756200000000 implements MigrationInterface {
  name = 'RemoveProfitShare1756200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    const run = (sql: string) => queryRunner.query(sql);

    await run(
      `ALTER TABLE "contract_fundings" DROP CONSTRAINT IF EXISTS "contract_fundings_profit_share_pct_check"`,
    );
    await run(
      `ALTER TABLE "contract_fundings" DROP COLUMN IF EXISTS "profit_share_pct"`,
    );
    await run(
      `ALTER TABLE "contract_fundings" DROP COLUMN IF EXISTS "share_override_reason"`,
    );

    await run(
      `ALTER TABLE "investors" DROP CONSTRAINT IF EXISTS "investors_profit_share_pct_check"`,
    );
    await run(`ALTER TABLE "investors" DROP COLUMN IF EXISTS "profit_share_pct"`);

    await run(`DELETE FROM "settings" WHERE "key" = 'default_profit_share_pct'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = queryRunner.connection.driver.schema ?? 'public';

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error(`Refusing to use "${schema}" as a schema name.`);
    }

    await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);

    const run = (sql: string) => queryRunner.query(sql);

    await run(
      `ALTER TABLE "investors" ADD COLUMN IF NOT EXISTS "profit_share_pct" DECIMAL(5,2) NOT NULL DEFAULT 50.00`,
    );
    await run(`
      ALTER TABLE "investors"
      ADD CONSTRAINT "investors_profit_share_pct_check"
      CHECK ("profit_share_pct" >= 0 AND "profit_share_pct" <= 100)
    `);

    await run(
      `ALTER TABLE "contract_fundings" ADD COLUMN IF NOT EXISTS "profit_share_pct" DECIMAL(5,2) NOT NULL DEFAULT 0.00`,
    );
    await run(
      `ALTER TABLE "contract_fundings" ADD COLUMN IF NOT EXISTS "share_override_reason" TEXT`,
    );
    await run(`
      ALTER TABLE "contract_fundings"
      ADD CONSTRAINT "contract_fundings_profit_share_pct_check"
      CHECK ("profit_share_pct" >= 0 AND "profit_share_pct" <= 100)
    `);

    await run(`
      INSERT INTO "settings" ("key", "value", "updated_at")
      VALUES ('default_profit_share_pct', '50.00', CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO NOTHING
    `);
  }
}
