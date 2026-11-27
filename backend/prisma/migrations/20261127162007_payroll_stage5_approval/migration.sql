-- CreateEnum
CREATE TYPE "pay_warning" AS ENUM ('NET_ZERO', 'NO_BANK_ACCOUNT', 'BANK_INCOMPLETE', 'BIG_CHANGE', 'LEAVING', 'ABSENT_THROUGHOUT', 'DUPLICATE_INPUT', 'LARGE_INPUT', 'NO_PAN', 'NO_UAN', 'NO_AADHAAR', 'NO_ESIC_NUMBER', 'NO_PF_UNDER_CEILING', 'NO_TAX_OPENING', 'EPS_AGE_SOON');

-- AlterEnum
ALTER TYPE "approval_feature" ADD VALUE 'PAYROLL';

-- AlterEnum
ALTER TYPE "approval_kind" ADD VALUE 'PAY_RUN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "payroll_run_status" ADD VALUE 'IN_APPROVAL';
ALTER TYPE "payroll_run_status" ADD VALUE 'FINALISED';

-- AlterTable
ALTER TABLE "approval_requests" ADD COLUMN     "company_id" INTEGER,
ALTER COLUMN "employee_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "approval_request_id" INTEGER,
ADD COLUMN     "finalised_at" TIMESTAMPTZ(3),
ADD COLUMN     "finalised_by_id" INTEGER;

-- CreateTable
CREATE TABLE "payroll_run_acknowledgements" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "warning" "pay_warning" NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_run_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" INTEGER NOT NULL,
    "tds_counts_draft_runs" BOOLEAN NOT NULL DEFAULT false,
    "big_change_percent" SMALLINT NOT NULL DEFAULT 20,
    "eps_age_soon_months" SMALLINT NOT NULL DEFAULT 2,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_acknowledgements_payroll_run_employee_id_warnin_key" ON "payroll_run_acknowledgements"("payroll_run_employee_id", "warning");

-- CreateIndex
CREATE INDEX "approval_requests_company_id_idx" ON "approval_requests"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_approval_request_id_key" ON "payroll_runs"("approval_request_id");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_acknowledgements" ADD CONSTRAINT "payroll_run_acknowledgements_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A request is about exactly one: an employee or a whole company (payroll stage 5)
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_one_subject" CHECK (("employee_id" IS NULL) <> ("company_id" IS NULL));
-- Finalised: when and by whom, set together
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_finalised_pair" CHECK (("finalised_at" IS NULL) = ("finalised_by_id" IS NULL));
-- An acknowledgement says why
ALTER TABLE "payroll_run_acknowledgements" ADD CONSTRAINT "payroll_run_acknowledgements_comment" CHECK (char_length(btrim("comment")) >= 3);
-- One settings row; sensible limits
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_one_row" CHECK ("id" = 1 AND "big_change_percent" BETWEEN 1 AND 1000 AND "eps_age_soon_months" BETWEEN 0 AND 24);
