-- AlterTable
ALTER TABLE "candidate_documents" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "employee_documents" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- Documents deleted before this column existed
UPDATE "candidate_documents" SET "is_deleted" = true WHERE "deleted_at" IS NOT NULL;
UPDATE "employee_documents" SET "is_deleted" = true WHERE "deleted_at" IS NOT NULL;
