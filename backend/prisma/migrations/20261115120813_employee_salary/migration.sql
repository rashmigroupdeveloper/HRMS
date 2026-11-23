-- CreateTable
CREATE TABLE "employee_salaries" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "annual_ctc" INTEGER NOT NULL,
    "performance_pay_annual" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_lines" (
    "id" SERIAL NOT NULL,
    "employee_salary_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "monthly_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_salary_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_salaries_employee_id_effective_from_key" ON "employee_salaries"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_salary_lines_salary_component_id_idx" ON "employee_salary_lines"("salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_salary_lines_employee_salary_id_salary_component_i_key" ON "employee_salary_lines"("employee_salary_id", "salary_component_id");

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_lines" ADD CONSTRAINT "employee_salary_lines_employee_salary_id_fkey" FOREIGN KEY ("employee_salary_id") REFERENCES "employee_salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_lines" ADD CONSTRAINT "employee_salary_lines_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Employees who already joined get the salary of the offer they joined from, effective from their date of joining,
-- with its breakup (written by hand before this migration was applied, 2026-11-15; recorded as SYSTEM = 0)
INSERT INTO "employee_salaries" ("employee_id", "effective_from", "annual_ctc", "performance_pay_annual", "currency", "created_by_id", "updated_at", "updated_by_id")
SELECT e."id", e."date_of_joining", c."annual_ctc", c."performance_pay_annual", c."ctc_currency", 0, CURRENT_TIMESTAMP, 0
FROM "candidates" c JOIN "employees" e ON e."id" = c."employee_id";

INSERT INTO "employee_salary_lines" ("employee_salary_id", "salary_component_id", "monthly_amount", "created_by_id", "updated_at", "updated_by_id")
SELECT s."id", l."salary_component_id", l."monthly_amount", 0, CURRENT_TIMESTAMP, 0
FROM "candidate_salary_lines" l
JOIN "candidates" c ON c."id" = l."candidate_id"
JOIN "employee_salaries" s ON s."employee_id" = c."employee_id";
