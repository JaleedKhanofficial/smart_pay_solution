-- Uploads are stored as "<name> - <cnic> - <dd-mm-yyyy>.<ext>" inside a folder
-- per subject (customer, guarantor_1, guarantor_2) instead of a flat UUID name.
-- The readable name is not unique on its own, so uniqueness moves to the path.
--
-- Rows written before this migration keep their UUID filenames and paths; they
-- are still served correctly because lookups go by file id, never by name.

ALTER TABLE "files" RENAME COLUMN "uuid_name" TO "stored_name";

DROP INDEX "files_uuid_name_key";

CREATE UNIQUE INDEX "files_storage_path_key" ON "files"("storage_path");
