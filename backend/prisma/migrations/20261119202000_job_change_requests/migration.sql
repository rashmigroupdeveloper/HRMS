-- CreateEnum
CREATE TYPE "job_change_status" AS ENUM ('PENDING', 'APPROVED', 'APPLIED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "job_change_kind" ADD VALUE 'COMPANY_TRANSFER';
ALTER TYPE "job_change_kind" ADD VALUE 'SALARY_REVISION';
ALTER TYPE "job_change_kind" ADD VALUE 'SALARY_CORRECTION';

-- A planned timeline entry (not in force yet) becomes a job-change request from now on (2026-11-20): any left is removed
-- (written by hand - there are none on the dev database; the test database may hold old test rows)
DELETE FROM "employee_job_records" WHERE "applied_at" IS NULL;

-- AlterTable
ALTER TABLE "employee_job_records" DROP COLUMN "applied_at",
DROP COLUMN "applied_by_id",
ADD COLUMN     "job_change_request_id" INTEGER;

-- CreateTable
CREATE TABLE "job_change_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "approval_request_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "kind" "job_change_kind" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "job_change_status" NOT NULL DEFAULT 'PENDING',
    "changed_fields" TEXT[],
    "plant_id" INTEGER,
    "department_id" INTEGER,
    "work_location_id" INTEGER,
    "designation_id" INTEGER,
    "grade_id" INTEGER,
    "position_id" INTEGER,
    "cost_center_id" INTEGER,
    "reporting_manager_id" INTEGER,
    "functional_manager_id" INTEGER,
    "employment_type" "employment_type",
    "workforce_category" "workforce_category",
    "apply_error" TEXT,
    "applied_at" TIMESTAMPTZ(3),
    "applied_by_id" INTEGER,
    "before" JSONB,
    "notified_at" TIMESTAMPTZ(3),
    "notified_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "job_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_change_requests_approval_request_id_key" ON "job_change_requests"("approval_request_id");

-- CreateIndex
CREATE INDEX "job_change_requests_employee_id_idx" ON "job_change_requests"("employee_id");

-- CreateIndex
CREATE INDEX "job_change_requests_status_idx" ON "job_change_requests"("status");

-- CreateIndex
CREATE INDEX "job_change_requests_effective_from_idx" ON "job_change_requests"("effective_from");

-- CreateIndex
CREATE INDEX "job_change_requests_plant_id_idx" ON "job_change_requests"("plant_id");

-- CreateIndex
CREATE INDEX "job_change_requests_department_id_idx" ON "job_change_requests"("department_id");

-- CreateIndex
CREATE INDEX "job_change_requests_work_location_id_idx" ON "job_change_requests"("work_location_id");

-- CreateIndex
CREATE INDEX "job_change_requests_designation_id_idx" ON "job_change_requests"("designation_id");

-- CreateIndex
CREATE INDEX "job_change_requests_grade_id_idx" ON "job_change_requests"("grade_id");

-- CreateIndex
CREATE INDEX "job_change_requests_position_id_idx" ON "job_change_requests"("position_id");

-- CreateIndex
CREATE INDEX "job_change_requests_cost_center_id_idx" ON "job_change_requests"("cost_center_id");

-- CreateIndex
CREATE INDEX "job_change_requests_reporting_manager_id_idx" ON "job_change_requests"("reporting_manager_id");

-- CreateIndex
CREATE INDEX "job_change_requests_functional_manager_id_idx" ON "job_change_requests"("functional_manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_job_records_job_change_request_id_key" ON "employee_job_records"("job_change_request_id");

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_job_change_request_id_fkey" FOREIGN KEY ("job_change_request_id") REFERENCES "job_change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_functional_manager_id_fkey" FOREIGN KEY ("functional_manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open job change per employee (waiting for approval, or approved and waiting for its day) - written by hand
CREATE UNIQUE INDEX "job_change_requests_one_open" ON "job_change_requests" ("employee_id") WHERE "status" IN ('PENDING', 'APPROVED');
