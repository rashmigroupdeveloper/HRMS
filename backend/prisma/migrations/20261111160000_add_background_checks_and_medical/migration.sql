-- CreateEnum
CREATE TYPE "medical_result" AS ENUM ('FIT', 'FIT_WITH_RESTRICTIONS', 'UNFIT');

-- CreateEnum
CREATE TYPE "bgv_check_type" AS ENUM ('IDENTITY', 'ADDRESS', 'EDUCATION', 'EMPLOYMENT', 'CRIMINAL', 'REFERENCE');

-- CreateEnum
CREATE TYPE "bgv_check_status" AS ENUM ('IN_PROGRESS', 'CLEAR', 'DISCREPANCY', 'FAILED');

-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'BGV_CONSENT_FORM';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "joining_confirmed_at" TIMESTAMPTZ(3),
ADD COLUMN     "medical_exam_date" DATE,
ADD COLUMN     "medical_examiner" TEXT,
ADD COLUMN     "medical_restrictions" TEXT,
ADD COLUMN     "medical_result" "medical_result";

-- AlterTable
ALTER TABLE "employee_onboardings" DROP COLUMN "background_verification";

-- DropEnum
DROP TYPE "bgv_status";

-- CreateTable
CREATE TABLE "background_checks" (
    "id" SERIAL NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "type" "bgv_check_type" NOT NULL,
    "subject" TEXT,
    "status" "bgv_check_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "vendor_name" TEXT,
    "vendor_reference" TEXT,
    "remarks" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "background_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "background_checks_candidate_id_idx" ON "background_checks"("candidate_id");

-- AddForeignKey
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
