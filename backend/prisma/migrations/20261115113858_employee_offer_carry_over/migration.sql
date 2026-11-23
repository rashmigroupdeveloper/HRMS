-- AlterTable
ALTER TABLE "employee_onboardings" ADD COLUMN     "medical_exam_date" DATE,
ADD COLUMN     "medical_examiner" TEXT,
ADD COLUMN     "medical_restrictions" TEXT,
ADD COLUMN     "medical_result" "medical_result";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "notice_months_confirmed" SMALLINT,
ADD COLUMN     "notice_months_probation" SMALLINT,
ADD COLUMN     "salutation" "salutation";

-- Employees who already joined get these from the offer they joined from (written by hand before this migration was
-- applied, 2026-11-15)
UPDATE "employees" e SET "salutation" = c."salutation", "notice_months_probation" = c."notice_months_probation",
  "notice_months_confirmed" = c."notice_months_confirmed"
FROM "candidates" c WHERE c."employee_id" = e."id";

UPDATE "employee_onboardings" o SET "medical_result" = c."medical_result", "medical_exam_date" = c."medical_exam_date",
  "medical_examiner" = c."medical_examiner", "medical_restrictions" = c."medical_restrictions"
FROM "candidates" c WHERE c."employee_id" = o."employee_id";
