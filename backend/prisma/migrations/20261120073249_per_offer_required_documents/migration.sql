-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "document_type" ADD VALUE 'CLASS_X_MARKSHEET';
ALTER TYPE "document_type" ADD VALUE 'CLASS_XII_MARKSHEET';
ALTER TYPE "document_type" ADD VALUE 'GRADUATION_CERTIFICATE';
ALTER TYPE "document_type" ADD VALUE 'POST_GRADUATION_CERTIFICATE';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "extra_required_documents" "document_type"[] DEFAULT ARRAY[]::"document_type"[];
