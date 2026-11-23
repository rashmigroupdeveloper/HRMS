-- AlterTable
ALTER TABLE "candidate_documents" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "deleted_by_id" INTEGER;

-- AlterTable
ALTER TABLE "employee_documents" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "deleted_by_id" INTEGER;
