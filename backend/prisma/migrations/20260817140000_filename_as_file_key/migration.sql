-- The filename becomes the files key, so customers.cnic_file_id and
-- guarantors.cnic_file_id read as "Jaleed Khan - 17202-0421424-1 - 18-08-2026.png"
-- instead of an opaque UUID, while staying real foreign keys.
--
-- Existing rows are carried across by rewriting each reference to the file's
-- stored_name before the key is swapped.

-- 1. Detach the references.
ALTER TABLE "customers" DROP CONSTRAINT "customers_cnic_file_id_fkey";
ALTER TABLE "guarantors" DROP CONSTRAINT "guarantors_cnic_file_id_fkey";
ALTER TABLE "ledger_snapshots" DROP CONSTRAINT "ledger_snapshots_pdf_file_id_fkey";

-- 2. Re-point each reference at the filename.
ALTER TABLE "customers" ADD COLUMN "new_cnic_file_id" TEXT;
UPDATE "customers" c
SET "new_cnic_file_id" = f."stored_name"
FROM "files" f
WHERE f."id" = c."cnic_file_id";
ALTER TABLE "customers" DROP COLUMN "cnic_file_id";
ALTER TABLE "customers" RENAME COLUMN "new_cnic_file_id" TO "cnic_file_id";

ALTER TABLE "guarantors" ADD COLUMN "new_cnic_file_id" TEXT;
UPDATE "guarantors" g
SET "new_cnic_file_id" = f."stored_name"
FROM "files" f
WHERE f."id" = g."cnic_file_id";
ALTER TABLE "guarantors" DROP COLUMN "cnic_file_id";
ALTER TABLE "guarantors" RENAME COLUMN "new_cnic_file_id" TO "cnic_file_id";

ALTER TABLE "ledger_snapshots" ADD COLUMN "new_pdf_file_id" TEXT;
UPDATE "ledger_snapshots" s
SET "new_pdf_file_id" = f."stored_name"
FROM "files" f
WHERE f."id" = s."pdf_file_id";
ALTER TABLE "ledger_snapshots" DROP COLUMN "pdf_file_id";
ALTER TABLE "ledger_snapshots" RENAME COLUMN "new_pdf_file_id" TO "pdf_file_id";

-- 3. Swap the key: the UUID goes, stored_name becomes the primary key.
ALTER TABLE "files" DROP CONSTRAINT "files_pkey";
ALTER TABLE "files" DROP COLUMN "id";
ALTER TABLE "files" RENAME COLUMN "stored_name" TO "id";
ALTER TABLE "files" ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");

-- 4. Reattach the references.
ALTER TABLE "customers" ADD CONSTRAINT "customers_cnic_file_id_fkey" FOREIGN KEY ("cnic_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_cnic_file_id_fkey" FOREIGN KEY ("cnic_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_snapshots" ADD CONSTRAINT "ledger_snapshots_pdf_file_id_fkey" FOREIGN KEY ("pdf_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
