-- CreateEnum
CREATE TYPE "family_relationship" AS ENUM ('SPOUSE', 'SON', 'DAUGHTER', 'FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'FATHER_IN_LAW', 'MOTHER_IN_LAW', 'OTHER');

-- CreateEnum
CREATE TYPE "nomination_scheme" AS ENUM ('GENERAL', 'GRATUITY', 'ESIC');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "document_type" ADD VALUE 'EDUCATION_CERTIFICATE';
ALTER TYPE "document_type" ADD VALUE 'EXPERIENCE_LETTER';
ALTER TYPE "document_type" ADD VALUE 'DRIVING_LICENCE_COPY';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "joining_form_declaration" TEXT,
ADD COLUMN     "joining_form_return_reason" TEXT,
ADD COLUMN     "joining_form_returned_at" TIMESTAMPTZ(3),
ADD COLUMN     "joining_form_returned_by_id" INTEGER,
ADD COLUMN     "joining_form_sign_ip" TEXT,
ADD COLUMN     "joining_form_sign_user_agent" TEXT,
ADD COLUMN     "joining_form_signed_name" TEXT,
ADD COLUMN     "joining_form_submitted_at" TIMESTAMPTZ(3),
ADD COLUMN     "joining_form_submitted_by_id" INTEGER;

-- CreateTable
CREATE TABLE "employee_qualifications" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "qualification" TEXT NOT NULL,
    "institute" TEXT NOT NULL,
    "year_of_passing" SMALLINT NOT NULL,
    "specialization" TEXT,
    "score" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certifications" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "issued_by" TEXT NOT NULL,
    "certified_on" DATE,
    "specialization" TEXT,
    "score" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_previous_employments" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "employer_name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "reason_for_leaving" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_previous_employments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_family_members" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" "family_relationship" NOT NULL,
    "gender" "gender",
    "date_of_birth" DATE,
    "aadhaar_encrypted" TEXT,
    "aadhaar_last4" VARCHAR(4),
    "pre_existing_disease" TEXT,
    "lives_with_employee" BOOLEAN,
    "residence_town" TEXT,
    "residence_state" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_nominees" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "scheme" "nomination_scheme" NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "date_of_birth" DATE,
    "address" TEXT,
    "share_percent" SMALLINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_nominees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_sessions" (
    "id" SERIAL NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "candidate_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_qualifications_employee_id_idx" ON "employee_qualifications"("employee_id");

-- CreateIndex
CREATE INDEX "employee_certifications_employee_id_idx" ON "employee_certifications"("employee_id");

-- CreateIndex
CREATE INDEX "employee_previous_employments_employee_id_idx" ON "employee_previous_employments"("employee_id");

-- CreateIndex
CREATE INDEX "employee_family_members_employee_id_idx" ON "employee_family_members"("employee_id");

-- CreateIndex
CREATE INDEX "employee_nominees_employee_id_scheme_idx" ON "employee_nominees"("employee_id", "scheme");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_sessions_token_hash_key" ON "candidate_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "candidate_sessions_candidate_id_idx" ON "candidate_sessions"("candidate_id");

-- AddForeignKey
ALTER TABLE "employee_qualifications" ADD CONSTRAINT "employee_qualifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_previous_employments" ADD CONSTRAINT "employee_previous_employments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_family_members" ADD CONSTRAINT "employee_family_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_nominees" ADD CONSTRAINT "employee_nominees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_sessions" ADD CONSTRAINT "candidate_sessions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
