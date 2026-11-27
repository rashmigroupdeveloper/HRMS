-- AlterTable
ALTER TABLE "salary_components" ADD COLUMN     "cut_for_unpaid_days" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "payroll_run_lines" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_run_lines_salary_component_id_idx" ON "payroll_run_lines"("salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_lines_payroll_run_employee_id_salary_component__key" ON "payroll_run_lines"("payroll_run_employee_id", "salary_component_id");

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- An amount is never below zero (a deduction is a positive amount of a deduction component)
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_amount_not_negative" CHECK ("amount" >= 0);
