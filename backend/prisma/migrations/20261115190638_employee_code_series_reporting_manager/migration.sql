-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "next_employee_number" INTEGER;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "reporting_manager_id" INTEGER;

-- CreateIndex
CREATE INDEX "employees_reporting_manager_id_idx" ON "employees"("reporting_manager_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
