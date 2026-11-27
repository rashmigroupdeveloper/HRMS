-- CreateEnum
CREATE TYPE "statutory_role" AS ENUM ('PF_EMPLOYEE', 'ESIC_EMPLOYEE', 'PROFESSIONAL_TAX', 'LWF_EMPLOYEE', 'INCOME_TAX', 'PF_EMPLOYER', 'EPS', 'EDLI', 'ESIC_EMPLOYER', 'LWF_EMPLOYER');

-- CreateEnum
CREATE TYPE "pay_hold" AS ENUM ('NOT_IN_PERIOD', 'NO_SALARY', 'OTHER_CURRENCY', 'DAYS_MISSING', 'NO_WORK_LOCATION', 'NO_RATE', 'NO_COMPONENT', 'OVER_HALF', 'TAX_TO_TYPE');

-- CreateEnum
CREATE TYPE "statutory_parameter" AS ENUM ('PF_EMPLOYEE_RATE', 'PF_EMPLOYER_RATE', 'EPS_RATE', 'EDLI_RATE', 'PF_WAGE_CEILING', 'EPS_AGE_LIMIT', 'ESIC_EMPLOYEE_RATE', 'ESIC_EMPLOYER_RATE', 'ESIC_WAGE_CEILING', 'ESIC_WAGE_CEILING_DISABLED', 'TAX_STANDARD_DEDUCTION', 'TAX_REBATE_INCOME_LIMIT', 'TAX_REBATE_MAX', 'TAX_CESS_RATE', 'TAX_SURCHARGE_FROM');

-- CreateEnum
CREATE TYPE "tax_regime" AS ENUM ('NEW', 'OLD');

-- AlterTable
ALTER TABLE "employee_statutory" ADD COLUMN     "eps_member" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pf_on_full_wages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax_regime" "tax_regime" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "payroll_run_employees" ADD COLUMN     "held_for" "pay_hold"[] DEFAULT ARRAY[]::"pay_hold"[],
ADD COLUMN     "held_note" TEXT;

-- AlterTable
ALTER TABLE "payroll_run_lines" ADD COLUMN     "base" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "payroll_run_salary_segments" ADD COLUMN     "work_location_id" INTEGER;

-- AlterTable
ALTER TABLE "salary_components" ADD COLUMN     "esi_wage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pf_wage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statutory_role" "statutory_role",
ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "statutory_rates" (
    "id" SERIAL NOT NULL,
    "parameter" "statutory_parameter" NOT NULL,
    "effective_from" DATE NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "statutory_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_tax_slabs" (
    "id" SERIAL NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "gender" "gender",
    "wages_from" INTEGER NOT NULL,
    "wages_to" INTEGER,
    "amount" INTEGER NOT NULL,
    "special_month" SMALLINT,
    "special_amount" INTEGER,
    "reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "professional_tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labour_welfare_rates" (
    "id" SERIAL NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "employee_amount" DECIMAL(8,2) NOT NULL,
    "employer_amount" DECIMAL(8,2) NOT NULL,
    "months" SMALLINT[],
    "reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "labour_welfare_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_tax_slabs" (
    "id" SERIAL NOT NULL,
    "regime" "tax_regime" NOT NULL,
    "tax_year_from" DATE NOT NULL,
    "income_from" INTEGER NOT NULL,
    "income_to" INTEGER,
    "rate_percent" DECIMAL(5,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "income_tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_opening_balances" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "tax_year_from" DATE NOT NULL,
    "through_pay_month" DATE NOT NULL,
    "taxable_income" INTEGER NOT NULL,
    "tax_deducted" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "tax_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "statutory_rates_parameter_effective_from_key" ON "statutory_rates"("parameter", "effective_from");

-- CreateIndex
CREATE INDEX "professional_tax_slabs_state_code_effective_from_idx" ON "professional_tax_slabs"("state_code", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "labour_welfare_rates_state_code_effective_from_key" ON "labour_welfare_rates"("state_code", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "income_tax_slabs_regime_tax_year_from_income_from_key" ON "income_tax_slabs"("regime", "tax_year_from", "income_from");

-- CreateIndex
CREATE UNIQUE INDEX "tax_opening_balances_employee_id_tax_year_from_key" ON "tax_opening_balances"("employee_id", "tax_year_from");

-- CreateIndex
CREATE INDEX "payroll_run_salary_segments_work_location_id_idx" ON "payroll_run_salary_segments"("work_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_statutory_role_key" ON "salary_components"("statutory_role");

-- AddForeignKey
ALTER TABLE "payroll_run_salary_segments" ADD CONSTRAINT "payroll_run_salary_segments_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_opening_balances" ADD CONSTRAINT "tax_opening_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sensible values (the services check them first, with plain messages)
ALTER TABLE "statutory_rates" ADD CONSTRAINT "statutory_rates_value_not_negative" CHECK ("value" >= 0);
ALTER TABLE "professional_tax_slabs" ADD CONSTRAINT "professional_tax_slabs_range" CHECK ("wages_from" >= 0 AND ("wages_to" IS NULL OR "wages_to" >= "wages_from") AND "amount" >= 0);
ALTER TABLE "professional_tax_slabs" ADD CONSTRAINT "professional_tax_slabs_special_month" CHECK (("special_month" IS NULL) = ("special_amount" IS NULL) AND ("special_month" IS NULL OR "special_month" BETWEEN 1 AND 12) AND ("special_amount" IS NULL OR "special_amount" >= 0));
ALTER TABLE "labour_welfare_rates" ADD CONSTRAINT "labour_welfare_rates_amounts" CHECK ("employee_amount" >= 0 AND "employer_amount" >= 0 AND "months" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::SMALLINT[]);
ALTER TABLE "income_tax_slabs" ADD CONSTRAINT "income_tax_slabs_range" CHECK ("income_from" >= 0 AND ("income_to" IS NULL OR "income_to" > "income_from") AND "rate_percent" BETWEEN 0 AND 100);
ALTER TABLE "tax_opening_balances" ADD CONSTRAINT "tax_opening_balances_figures" CHECK ("taxable_income" >= 0 AND "tax_deducted" >= 0 AND EXTRACT(DAY FROM "through_pay_month") = 1 AND "through_pay_month" >= "tax_year_from" AND "through_pay_month" < "tax_year_from" + INTERVAL '1 year');
