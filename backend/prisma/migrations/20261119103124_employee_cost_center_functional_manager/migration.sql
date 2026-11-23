-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "cost_center_id" INTEGER,
ADD COLUMN     "functional_manager_id" INTEGER;

-- CreateIndex
CREATE INDEX "employees_cost_center_id_idx" ON "employees"("cost_center_id");

-- CreateIndex
CREATE INDEX "employees_functional_manager_id_idx" ON "employees"("functional_manager_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_functional_manager_id_fkey" FOREIGN KEY ("functional_manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
