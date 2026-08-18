-- Guarantors move from a UUID primary key to a sequential integer, matching the
-- customer key. Nothing references guarantors.id, so this is a straight swap;
-- existing rows are renumbered by creation order rather than recreated.

ALTER TABLE "guarantors" ADD COLUMN "new_id" SERIAL;

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
  FROM "guarantors"
)
UPDATE "guarantors" g
SET "new_id" = o.rn
FROM ordered o
WHERE g."id" = o."id";

SELECT setval(
  pg_get_serial_sequence('guarantors', 'new_id'),
  COALESCE((SELECT MAX("new_id") FROM "guarantors"), 0) + 1,
  false
);

ALTER TABLE "guarantors" DROP CONSTRAINT "guarantors_pkey";
ALTER TABLE "guarantors" DROP COLUMN "id";
ALTER TABLE "guarantors" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_pkey" PRIMARY KEY ("id");
ALTER SEQUENCE "guarantors_new_id_seq" RENAME TO "guarantors_id_seq";
