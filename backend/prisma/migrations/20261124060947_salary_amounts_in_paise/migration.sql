-- AlterTable
ALTER TABLE "candidate_salary_lines" ALTER COLUMN "monthly_amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "employee_salary_lines" ALTER COLUMN "monthly_amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "job_change_salary_lines" ALTER COLUMN "monthly_amount" SET DATA TYPE DECIMAL(12,2);
