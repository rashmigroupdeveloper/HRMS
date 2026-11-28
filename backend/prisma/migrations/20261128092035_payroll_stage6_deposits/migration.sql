-- CreateEnum
CREATE TYPE "statutory_scheme" AS ENUM ('PF', 'ESIC', 'PROFESSIONAL_TAX', 'LWF');

-- CreateEnum
CREATE TYPE "deposit_gap_reason" AS ENUM ('NO_UAN', 'NO_ESIC_NUMBER', 'DETAILS_MISMATCH', 'PREVIOUS_EMPLOYER', 'OTHER');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'STATUTORY_DEPOSITS';

-- AlterTable
ALTER TABLE "payroll_settings" ADD COLUMN     "deposit_reminder_days" SMALLINT NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "statutory_due_dates" (
    "id" SERIAL NOT NULL,
    "scheme" "statutory_scheme" NOT NULL,
    "state_code" CHAR(2),
    "effective_from" DATE NOT NULL,
    "day" SMALLINT NOT NULL,
    "reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "statutory_due_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_deposits" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "scheme" "statutory_scheme" NOT NULL,
    "state_code" CHAR(2),
    "pay_month" DATE NOT NULL,
    "reference" TEXT NOT NULL,
    "filed_on" DATE NOT NULL,
    "contributions" DECIMAL(12,2) NOT NULL,
    "other_charges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_on" DATE,
    "payment_reference" TEXT,
    "paid_at" TIMESTAMPTZ(3),
    "paid_by_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "statutory_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_deposit_gaps" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "scheme" "statutory_scheme" NOT NULL,
    "reason" "deposit_gap_reason" NOT NULL,
    "note" TEXT,
    "deposit_id" INTEGER,
    "covered_at" TIMESTAMPTZ(3),
    "covered_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "statutory_deposit_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "statutory_deposits_company_id_pay_month_idx" ON "statutory_deposits"("company_id", "pay_month");

-- CreateIndex
CREATE INDEX "statutory_deposit_gaps_deposit_id_idx" ON "statutory_deposit_gaps"("deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_deposit_gaps_payroll_run_employee_id_scheme_key" ON "statutory_deposit_gaps"("payroll_run_employee_id", "scheme");

-- AddForeignKey
ALTER TABLE "statutory_deposits" ADD CONSTRAINT "statutory_deposits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_deposit_gaps" ADD CONSTRAINT "statutory_deposit_gaps_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_deposit_gaps" ADD CONSTRAINT "statutory_deposit_gaps_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "statutory_deposits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Stage 6 slice 3 rules the schema cannot say (approved 2026-11-28)
-- one due date per scheme, State and date (the State may be empty, so a plain unique key would not hold)
CREATE UNIQUE INDEX "statutory_due_dates_one_per_day" ON "statutory_due_dates" ("scheme", COALESCE("state_code", ''), "effective_from");
-- professional tax and LWF go by State; PF and ESIC never
ALTER TABLE "statutory_due_dates" ADD CONSTRAINT "statutory_due_dates_state_per_scheme" CHECK (("scheme" IN ('PROFESSIONAL_TAX', 'LWF')) = ("state_code" IS NOT NULL));
ALTER TABLE "statutory_due_dates" ADD CONSTRAINT "statutory_due_dates_day" CHECK ("day" BETWEEN 1 AND 31);
ALTER TABLE "statutory_deposits" ADD CONSTRAINT "statutory_deposits_state_per_scheme" CHECK (("scheme" IN ('PROFESSIONAL_TAX', 'LWF')) = ("state_code" IS NOT NULL));
-- a pay month is its first day
ALTER TABLE "statutory_deposits" ADD CONSTRAINT "statutory_deposits_pay_month_first_day" CHECK (EXTRACT(DAY FROM "pay_month") = 1);
-- amounts never below zero, and something is deposited
ALTER TABLE "statutory_deposits" ADD CONSTRAINT "statutory_deposits_amounts" CHECK ("contributions" >= 0 AND "other_charges" >= 0 AND "contributions" + "other_charges" > 0);
-- paid: the day, the reference and who recorded it when - together
ALTER TABLE "statutory_deposits" ADD CONSTRAINT "statutory_deposits_paid_together" CHECK (("paid_on" IS NULL) = ("payment_reference" IS NULL) AND ("paid_on" IS NULL) = ("paid_at" IS NULL) AND ("paid_on" IS NULL) = ("paid_by_id" IS NULL));
-- people are left out of PF and ESIC returns only; OTHER says why
ALTER TABLE "statutory_deposit_gaps" ADD CONSTRAINT "statutory_deposit_gaps_scheme" CHECK ("scheme" IN ('PF', 'ESIC'));
ALTER TABLE "statutory_deposit_gaps" ADD CONSTRAINT "statutory_deposit_gaps_other_has_note" CHECK ("reason" <> 'OTHER' OR "note" IS NOT NULL);
-- taken in: the deposit, who recorded it when - together
ALTER TABLE "statutory_deposit_gaps" ADD CONSTRAINT "statutory_deposit_gaps_covered_together" CHECK (("deposit_id" IS NULL) = ("covered_at" IS NULL) AND ("deposit_id" IS NULL) = ("covered_by_id" IS NULL));
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_deposit_reminder_days" CHECK ("deposit_reminder_days" BETWEEN 0 AND 30);
