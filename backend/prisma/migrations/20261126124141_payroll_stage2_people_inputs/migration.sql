-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "people_refreshed_at" TIMESTAMPTZ(3),
ADD COLUMN     "people_refreshed_by_id" INTEGER;

-- AlterTable
ALTER TABLE "salary_components" ADD COLUMN     "code" TEXT,
ADD COLUMN     "entered_monthly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "payroll_run_employees" (
    "id" SERIAL NOT NULL,
    "payroll_run_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "employee_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_run_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_salary_segments" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "plant_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "cost_center_id" INTEGER,
    "employment_type" "employment_type" NOT NULL,
    "workforce_category" "workforce_category" NOT NULL,
    "employee_salary_id" INTEGER,
    "annual_ctc" INTEGER,
    "currency" CHAR(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_run_salary_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_salary_lines" (
    "id" SERIAL NOT NULL,
    "segment_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_run_salary_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_inputs" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_run_employees_employee_id_idx" ON "payroll_run_employees"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_employees_payroll_run_id_employee_id_key" ON "payroll_run_employees"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_run_salary_segments_plant_id_idx" ON "payroll_run_salary_segments"("plant_id");

-- CreateIndex
CREATE INDEX "payroll_run_salary_segments_department_id_idx" ON "payroll_run_salary_segments"("department_id");

-- CreateIndex
CREATE INDEX "payroll_run_salary_segments_cost_center_id_idx" ON "payroll_run_salary_segments"("cost_center_id");

-- CreateIndex
CREATE INDEX "payroll_run_salary_segments_employee_salary_id_idx" ON "payroll_run_salary_segments"("employee_salary_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_salary_segments_payroll_run_employee_id_from_da_key" ON "payroll_run_salary_segments"("payroll_run_employee_id", "from_date");

-- CreateIndex
CREATE INDEX "payroll_run_salary_lines_salary_component_id_idx" ON "payroll_run_salary_lines"("salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_salary_lines_segment_id_salary_component_id_key" ON "payroll_run_salary_lines"("segment_id", "salary_component_id");

-- CreateIndex
CREATE INDEX "payroll_inputs_payroll_run_employee_id_idx" ON "payroll_inputs"("payroll_run_employee_id");

-- CreateIndex
CREATE INDEX "payroll_inputs_salary_component_id_idx" ON "payroll_inputs"("salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_code_key" ON "salary_components"("code");

-- AddForeignKey
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_salary_segments" ADD CONSTRAINT "payroll_run_salary_segments_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_salary_segments" ADD CONSTRAINT "payroll_run_salary_segments_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_salary_segments" ADD CONSTRAINT "payroll_run_salary_segments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_salary_segments" ADD CONSTRAINT "payroll_run_salary_segments_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_salary_segments" ADD CONSTRAINT "payroll_run_salary_segments_employee_salary_id_fkey" FOREIGN KEY ("employee_salary_id") REFERENCES "employee_salaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_salary_lines" ADD CONSTRAINT "payroll_run_salary_lines_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "payroll_run_salary_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_salary_lines" ADD CONSTRAINT "payroll_run_salary_lines_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Supplementing service validation (stage 2): a segment never ends before it starts, an input is more than 0, a copied
-- salary line is never negative, and the refresh time and actor are set together.
ALTER TABLE "payroll_run_salary_segments" ADD CONSTRAINT "payroll_run_salary_segments_date_order" CHECK ("from_date" <= "to_date");
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payroll_run_salary_lines" ADD CONSTRAINT "payroll_run_salary_lines_amount_not_negative" CHECK ("monthly_amount" >= 0);
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_people_refreshed_together" CHECK (("people_refreshed_at" IS NULL) = ("people_refreshed_by_id" IS NULL));
