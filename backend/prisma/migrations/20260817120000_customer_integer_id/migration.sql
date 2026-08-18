-- Customers move from a UUID primary key to a sequential integer, so staff can
-- quote a short reference number (1, 2, 3…). Every other table keeps its UUID.
--
-- Written by hand rather than generated, because the generated version would
-- drop the column and take the existing customers with it. Rows are renumbered
-- by creation order and their guarantors and contracts are remapped in place.

-- 1. New integer key, numbered by creation order.
ALTER TABLE "customers" ADD COLUMN "new_id" SERIAL;

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
  FROM "customers"
)
UPDATE "customers" c
SET "new_id" = o.rn
FROM ordered o
WHERE c."id" = o."id";

SELECT setval(
  pg_get_serial_sequence('customers', 'new_id'),
  COALESCE((SELECT MAX("new_id") FROM "customers"), 0) + 1,
  false
);

-- 2. Carry the new key into the children before anything is dropped.
ALTER TABLE "guarantors" ADD COLUMN "new_customer_id" INTEGER;
UPDATE "guarantors" g
SET "new_customer_id" = c."new_id"
FROM "customers" c
WHERE g."customer_id" = c."id";

ALTER TABLE "contracts" ADD COLUMN "new_customer_id" INTEGER;
UPDATE "contracts" ct
SET "new_customer_id" = c."new_id"
FROM "customers" c
WHERE ct."customer_id" = c."id";

-- 3. Drop the constraints and indexes that depend on the old key.
ALTER TABLE "guarantors" DROP CONSTRAINT "guarantors_customer_id_fkey";
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_customer_id_fkey";
DROP INDEX "guarantors_customer_id_position_key";
DROP INDEX "contracts_customer_id_idx";
ALTER TABLE "customers" DROP CONSTRAINT "customers_pkey";

-- 4. Swap the columns into place.
ALTER TABLE "guarantors" DROP COLUMN "customer_id";
ALTER TABLE "guarantors" RENAME COLUMN "new_customer_id" TO "customer_id";
ALTER TABLE "guarantors" ALTER COLUMN "customer_id" SET NOT NULL;

ALTER TABLE "contracts" DROP COLUMN "customer_id";
ALTER TABLE "contracts" RENAME COLUMN "new_customer_id" TO "customer_id";
ALTER TABLE "contracts" ALTER COLUMN "customer_id" SET NOT NULL;

ALTER TABLE "customers" DROP COLUMN "id";
ALTER TABLE "customers" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");
ALTER SEQUENCE "customers_new_id_seq" RENAME TO "customers_id_seq";

-- 5. Restore the indexes and foreign keys against the new key.
CREATE UNIQUE INDEX "guarantors_customer_id_position_key" ON "guarantors"("customer_id", "position");
CREATE INDEX "contracts_customer_id_idx" ON "contracts"("customer_id");

ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
