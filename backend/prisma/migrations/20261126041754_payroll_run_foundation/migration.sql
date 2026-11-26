-- CreateEnum
CREATE TYPE "payroll_run_status" AS ENUM ('DRAFT');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'PAYROLL';

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "pay_month" DATE NOT NULL,
    "attendance_from" DATE NOT NULL,
    "attendance_to" DATE NOT NULL,
    "status" "payroll_run_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_runs_pay_month_id_idx" ON "payroll_runs"("pay_month", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_company_id_pay_month_key" ON "payroll_runs"("company_id", "pay_month");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Calendar month identity and an ordered captured attendance period.
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_month_start" CHECK (EXTRACT(DAY FROM "pay_month") = 1);
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_attendance_order" CHECK ("attendance_from" <= "attendance_to");
