-- CreateEnum
CREATE TYPE "salary_reason" AS ENUM ('JOINING', 'INCREMENT', 'PROMOTION', 'CONFIRMATION', 'CORRECTION', 'OTHER');

-- AlterTable
ALTER TABLE "employee_salaries" ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "approved_by_id" INTEGER,
ADD COLUMN     "job_change_request_id" INTEGER,
ADD COLUMN     "reason" "salary_reason" NOT NULL DEFAULT 'JOINING';

-- CreateTable
CREATE TABLE "job_change_salaries" (
    "id" SERIAL NOT NULL,
    "job_change_request_id" INTEGER NOT NULL,
    "annual_ctc" INTEGER NOT NULL,
    "performance_pay_annual" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "job_change_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_change_salary_lines" (
    "id" SERIAL NOT NULL,
    "job_change_salary_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "monthly_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "job_change_salary_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_change_salaries_job_change_request_id_key" ON "job_change_salaries"("job_change_request_id");

-- CreateIndex
CREATE INDEX "job_change_salary_lines_salary_component_id_idx" ON "job_change_salary_lines"("salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_change_salary_lines_job_change_salary_id_salary_compone_key" ON "job_change_salary_lines"("job_change_salary_id", "salary_component_id");

-- CreateIndex
CREATE INDEX "employee_salaries_job_change_request_id_idx" ON "employee_salaries"("job_change_request_id");

-- AddForeignKey
ALTER TABLE "job_change_salaries" ADD CONSTRAINT "job_change_salaries_job_change_request_id_fkey" FOREIGN KEY ("job_change_request_id") REFERENCES "job_change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_salary_lines" ADD CONSTRAINT "job_change_salary_lines_job_change_salary_id_fkey" FOREIGN KEY ("job_change_salary_id") REFERENCES "job_change_salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_salary_lines" ADD CONSTRAINT "job_change_salary_lines_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_job_change_request_id_fkey" FOREIGN KEY ("job_change_request_id") REFERENCES "job_change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
