-- CreateEnum
CREATE TYPE "document_verification_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "joining_form_encrypted" TEXT;

-- AlterTable
ALTER TABLE "employee_documents" DROP COLUMN "verified_at",
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(3),
ADD COLUMN     "verification_status" "document_verification_status" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" SERIAL NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "type" "document_type" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "verification_status" "document_verification_status" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_documents_storage_key_key" ON "candidate_documents"("storage_key");

-- CreateIndex
CREATE INDEX "candidate_documents_candidate_id_type_idx" ON "candidate_documents"("candidate_id", "type");

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
