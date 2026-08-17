import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads the connection URL from schema.prisma; migration and
// introspection commands take it from here (SRS §2.2: Prisma owns all DDL).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
