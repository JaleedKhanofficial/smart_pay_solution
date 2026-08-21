# SmartPay Solutions v2 — API

NestJS 11 + TypeORM + PostgreSQL. Implements the SRS at
`../SRS-v2-SmartPay-NextJS-NestJS-PostgreSQL.md`; §2.8 there is the binding set
of persistence rules, and this file is the practical companion to it.

Everything is served under `/api/v1`. Swagger is at `/api/docs`.

## Getting started

```bash
cp .env.example .env      # then fill in DATABASE_URL and the two JWT secrets
npm install
npm run migration:run     # builds the schema, or adopts an existing one
npm run seed              # first admin; never overwrites an existing one
npm run start:dev
```

`start:dev` watches and recompiles. `start:prod` runs `dist/` and does **not**
watch — if you started it before a rebuild you are running yesterday's code,
which is worth remembering when a change appears to have no effect.

## Layout

```
src/
  common/           enums, pagination envelope, input normalisers
  database/
    data-source.ts    the connection, shared by the app and the CLI
    database.module.ts
    entities/         one file per table, plus the ENTITIES barrel
    migrations/       versioned DDL
    seed.ts
  auth/             login, refresh rotation, lockout, guards, JWT strategy
  users/            the slice auth needs; Module 9 adds admin CRUD
  files/            CNIC image storage and the authenticated download route
  audit/            append-only trail, written by every module
  customers/        Module 2 — the reference implementation
```

### The customer module

Copy its shape when you build Modules 3–11:

| File | Holds |
|---|---|
| `customers.controller.ts` | Routes, multipart, pipes, Swagger. No logic. |
| `customers.service.ts` | Business rules and transaction boundaries. |
| `customer-uploads.service.ts` | The three CNIC images, and what replaces what. |
| `customer.query.ts` | Filters and sorting, applied to a query builder. |
| `customer.mapper.ts` | Entity → response JSON, and the audit snapshot. |
| `dto/` | class-validator DTOs; also where input is normalised. |

A service that has grown past roughly 200 lines usually has one of these four
jobs buried in it.

## Database

The connection string lives in `DATABASE_URL`. Its `?schema=sps` parameter is
lifted out into TypeORM's own `schema` option by `data-source.ts`, because the
`pg` driver does not understand it.

`synchronize` is permanently off. The schema changes through migrations only:

```bash
npm run migration:show      # what is applied and what is pending
npm run migration:run       # apply pending migrations
npm run migration:revert    # roll back the most recent one
npm run migration:generate -- src/database/migrations/AddSomething
```

The baseline migration is idempotent: it builds the schema on an empty database
and adopts one that already has it, so an existing install needs no dump and
restore.

### Two rules worth knowing before you write a query

**`updated_at` needs a database default.** TypeORM writes `DEFAULT` for
`@CreateDateColumn` and `@UpdateDateColumn` on INSERT and lets PostgreSQL supply
the value. A column without `DEFAULT CURRENT_TIMESTAMP` therefore fails with a
NOT NULL violation on every insert. The baseline migration sets it on all
eleven tables that carry the column.

**Soft-deleted rows are already excluded.** `deleted_at` is a
`@DeleteDateColumn`, so TypeORM appends the condition itself. Never write
`deletedAt IS NULL` by hand; use `withDeleted()` when you genuinely need the
deleted rows, and `restore()` to bring one back.

## Testing a change by hand

Run a second instance on a spare port rather than disturbing the one on `:5000`:

```bash
PORT=5001 node dist/main.js
```

## Conventions

- Money is `decimal(12,2)` and stays a **string** end to end. Never parse it
  into a float.
- Dates are `timestamptz`; the API returns ISO strings and the UI formats them.
- Uploads are validated by magic bytes, not by the declared Content-Type, and
  are served only through `GET /api/v1/files/:id` behind the JWT guard.
- Every write records an audit row. Audit failures are logged, never thrown —
  bookkeeping must not fail the operation it describes.
