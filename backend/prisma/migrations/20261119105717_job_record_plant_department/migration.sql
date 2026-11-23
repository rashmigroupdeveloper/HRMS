-- DropIndex
DROP INDEX "employee_job_records_plant_id_idx";

-- CreateIndex
CREATE INDEX "employee_job_records_plant_id_department_id_idx" ON "employee_job_records"("plant_id", "department_id");

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_plant_id_department_id_fkey" FOREIGN KEY ("plant_id", "department_id") REFERENCES "plant_departments"("plant_id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;
