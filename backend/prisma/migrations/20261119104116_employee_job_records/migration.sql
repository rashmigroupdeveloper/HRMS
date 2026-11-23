-- CreateEnum
CREATE TYPE "job_change_kind" AS ENUM ('JOINING', 'PROMOTION', 'TRANSFER', 'REDESIGNATION', 'MANAGER_CHANGE', 'OTHER');

-- CreateTable
CREATE TABLE "employee_job_records" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "kind" "job_change_kind" NOT NULL,
    "note" TEXT,
    "plant_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "work_location_id" INTEGER,
    "designation_id" INTEGER,
    "grade_id" INTEGER,
    "position_id" INTEGER,
    "cost_center_id" INTEGER,
    "reporting_manager_id" INTEGER,
    "functional_manager_id" INTEGER,
    "employment_type" "employment_type" NOT NULL,
    "workforce_category" "workforce_category" NOT NULL,
    "applied_at" TIMESTAMPTZ(3),
    "applied_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_job_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_job_records_effective_from_idx" ON "employee_job_records"("effective_from");

-- CreateIndex
CREATE INDEX "employee_job_records_plant_id_idx" ON "employee_job_records"("plant_id");

-- CreateIndex
CREATE INDEX "employee_job_records_department_id_idx" ON "employee_job_records"("department_id");

-- CreateIndex
CREATE INDEX "employee_job_records_work_location_id_idx" ON "employee_job_records"("work_location_id");

-- CreateIndex
CREATE INDEX "employee_job_records_designation_id_idx" ON "employee_job_records"("designation_id");

-- CreateIndex
CREATE INDEX "employee_job_records_grade_id_idx" ON "employee_job_records"("grade_id");

-- CreateIndex
CREATE INDEX "employee_job_records_position_id_idx" ON "employee_job_records"("position_id");

-- CreateIndex
CREATE INDEX "employee_job_records_cost_center_id_idx" ON "employee_job_records"("cost_center_id");

-- CreateIndex
CREATE INDEX "employee_job_records_reporting_manager_id_idx" ON "employee_job_records"("reporting_manager_id");

-- CreateIndex
CREATE INDEX "employee_job_records_functional_manager_id_idx" ON "employee_job_records"("functional_manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_job_records_employee_id_effective_from_key" ON "employee_job_records"("employee_id", "effective_from");

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_functional_manager_id_fkey" FOREIGN KEY ("functional_manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
