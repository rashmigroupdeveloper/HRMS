-- AlterTable
ALTER TABLE "employee_job_records" ADD COLUMN     "company_id" INTEGER,
ADD COLUMN     "employee_code" TEXT;

-- The entries there already: the employee's company and code (no one has moved company before 2026-11-20) - by hand
UPDATE "employee_job_records" AS r SET "company_id" = e."company_id", "employee_code" = e."employee_code"
FROM "employees" AS e WHERE e."id" = r."employee_id";

ALTER TABLE "employee_job_records" ALTER COLUMN "company_id" SET NOT NULL, ALTER COLUMN "employee_code" SET NOT NULL;

-- AlterTable
ALTER TABLE "job_change_requests" ADD COLUMN     "company_id" INTEGER;

-- CreateTable
CREATE TABLE "employee_former_codes" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "employee_code" TEXT NOT NULL,
    "company_id" INTEGER NOT NULL,
    "used_until" DATE NOT NULL,
    "job_change_request_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_former_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_former_codes_employee_code_key" ON "employee_former_codes"("employee_code");

-- CreateIndex
CREATE INDEX "employee_former_codes_employee_id_idx" ON "employee_former_codes"("employee_id");

-- CreateIndex
CREATE INDEX "employee_former_codes_company_id_idx" ON "employee_former_codes"("company_id");

-- CreateIndex
CREATE INDEX "employee_former_codes_job_change_request_id_idx" ON "employee_former_codes"("job_change_request_id");

-- CreateIndex
CREATE INDEX "employee_job_records_company_id_idx" ON "employee_job_records"("company_id");

-- CreateIndex
CREATE INDEX "job_change_requests_company_id_idx" ON "job_change_requests"("company_id");

-- AddForeignKey
ALTER TABLE "employee_job_records" ADD CONSTRAINT "employee_job_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_former_codes" ADD CONSTRAINT "employee_former_codes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_former_codes" ADD CONSTRAINT "employee_former_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_former_codes" ADD CONSTRAINT "employee_former_codes_job_change_request_id_fkey" FOREIGN KEY ("job_change_request_id") REFERENCES "job_change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_requests" ADD CONSTRAINT "job_change_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

