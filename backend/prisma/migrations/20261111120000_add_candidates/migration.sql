-- CreateEnum
CREATE TYPE "candidate_status" AS ENUM ('DRAFT', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN', 'BACKED_OUT', 'NO_SHOW');

-- AlterEnum
BEGIN;
CREATE TYPE "employee_status_new" AS ENUM ('ACTIVE', 'ON_NOTICE', 'EXITED');
ALTER TABLE "public"."employees" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "employees" ALTER COLUMN "status" TYPE "employee_status_new" USING ("status"::text::"employee_status_new");
ALTER TYPE "employee_status" RENAME TO "employee_status_old";
ALTER TYPE "employee_status_new" RENAME TO "employee_status";
DROP TYPE "public"."employee_status_old";
ALTER TABLE "employees" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "candidates" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT,
    "mobile" TEXT NOT NULL,
    "personal_email" TEXT,
    "company_id" INTEGER NOT NULL,
    "work_location_id" INTEGER,
    "department_id" INTEGER,
    "designation_id" INTEGER NOT NULL,
    "grade_id" INTEGER,
    "joining_type" "joining_type" NOT NULL,
    "employment_type" "employment_type" NOT NULL,
    "workforce_category" "workforce_category" NOT NULL,
    "annual_ctc" INTEGER NOT NULL,
    "ctc_currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "proposed_joining_date" DATE NOT NULL,
    "contract_end_date" DATE,
    "offer_valid_until" DATE,
    "status" "candidate_status" NOT NULL DEFAULT 'DRAFT',
    "offer_sent_at" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "close_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidates_status_idx" ON "candidates"("status");

-- CreateIndex
CREATE INDEX "candidates_company_id_idx" ON "candidates"("company_id");

-- CreateIndex
CREATE INDEX "candidates_work_location_id_idx" ON "candidates"("work_location_id");

-- CreateIndex
CREATE INDEX "candidates_department_id_idx" ON "candidates"("department_id");

-- CreateIndex
CREATE INDEX "candidates_designation_id_idx" ON "candidates"("designation_id");

-- CreateIndex
CREATE INDEX "candidates_grade_id_idx" ON "candidates"("grade_id");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
