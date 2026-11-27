-- AlterEnum
ALTER TYPE "letter_kind" ADD VALUE 'PAYSLIP';

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "payslip_template_id" INTEGER,
ADD COLUMN     "payslips_released_at" TIMESTAMPTZ(3),
ADD COLUMN     "payslips_released_by_id" INTEGER;

-- CreateTable
CREATE TABLE "payslips" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_run_employee_id_key" ON "payslips"("payroll_run_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_storage_key_key" ON "payslips"("storage_key");

-- CreateIndex
CREATE INDEX "payroll_runs_payslip_template_id_idx" ON "payroll_runs"("payslip_template_id");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payslip_template_id_fkey" FOREIGN KEY ("payslip_template_id") REFERENCES "letter_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Stage 6: the release columns are set together, once, and only on a finalised run
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payslips_released_together" CHECK (
  ("payslips_released_at" IS NULL) = ("payslips_released_by_id" IS NULL)
  AND ("payslips_released_at" IS NULL) = ("payslip_template_id" IS NULL)
);
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payslips_released_final" CHECK (
  "payslips_released_at" IS NULL OR "status" = 'FINALISED'
);
