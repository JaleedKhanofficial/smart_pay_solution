import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { Baseline1755500000000 } from './migrations/1755500000000-Baseline';

/**
 * The one place the connection is described. Both the Nest application
 * (DatabaseModule) and the TypeORM CLI build their options from here, so the
 * running app and the migration tooling cannot drift apart.
 *
 * DATABASE_URL carries `?schema=sps`, which is a convention the `pg` driver does
 * not understand — it is lifted out into TypeORM's own `schema` option and
 * stripped from the URL. That keeps .env exactly as it was under Prisma.
 */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  const parsed = new URL(url);
  const schema = parsed.searchParams.get('schema') ?? 'public';

  parsed.searchParams.delete('schema');

  return {
    type: 'postgres',
    url: parsed.toString(),
    schema,
    entities: ENTITIES,
    migrations: [Baseline1755500000000],
    migrationsTableName: 'migrations',
    // Never true. The database is described by the entities and changed only by
    // a reviewed migration; letting TypeORM alter a live schema on boot is how
    // production data gets dropped.
    synchronize: false,
    migrationsRun: false,
    logging: process.env.DB_LOGGING === 'true' ? 'all' : ['error'],
  };
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env.',
    );
  }

  return url;
}

/**
 * The default export is what `typeorm -d src/database/data-source.ts` loads.
 * It must be the file's ONLY export of a DataSource instance — exporting the
 * same instance twice (named and default) makes the CLI refuse to load it with
 * "must contain only one export of DataSource instance".
 */
const dataSource = new DataSource(buildDataSourceOptions(requireDatabaseUrl()));

export default dataSource;
