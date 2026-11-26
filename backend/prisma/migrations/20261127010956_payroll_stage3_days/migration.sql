-- CreateEnum
CREATE TYPE "pay_class" AS ENUM ('PAID', 'UNPAID', 'UNCLEAR');

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "computed_at" TIMESTAMPTZ(3),
ADD COLUMN     "computed_by_id" INTEGER;

-- CreateTable
CREATE TABLE "payroll_run_days" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "first_half" "pay_class" NOT NULL,
    "second_half" "pay_class" NOT NULL,
    "first_status" "day_status",
    "second_status" "day_status",
    "first_leave_code" TEXT,
    "second_leave_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_run_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_days_payroll_run_employee_id_date_key" ON "payroll_run_days"("payroll_run_employee_id", "date");

-- AddForeignKey
ALTER TABLE "payroll_run_days" ADD CONSTRAINT "payroll_run_days_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- When the days were worked out and by whom are set and cleared together (CLAUDE.md section 3)
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_computed_together" CHECK (("computed_at" IS NULL) = ("computed_by_id" IS NULL));
