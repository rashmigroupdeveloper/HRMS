-- AlterTable
ALTER TABLE "background_checks" ADD COLUMN     "employee_id" INTEGER,
ALTER COLUMN "candidate_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "background_checks_employee_id_idx" ON "background_checks"("employee_id");

-- AddForeignKey
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks of candidates who already joined belong to their employee (written by hand before this migration was
-- applied, 2026-11-15)
UPDATE "background_checks" b SET "employee_id" = c."employee_id"
FROM "candidates" c
WHERE c."id" = b."candidate_id" AND c."employee_id" IS NOT NULL AND b."employee_id" IS NULL;
