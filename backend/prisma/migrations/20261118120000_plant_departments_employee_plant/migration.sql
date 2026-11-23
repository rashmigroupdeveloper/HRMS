-- Company -> plant -> department, as VBMS (decided 2026-11-18):
--   * plant_departments: which departments run at which plant
--   * employees / candidates get a required plant of their own company; their department must run at that plant
-- Existing rows are given their company's first plant (active first, lowest plant code) - the user's choice for the
-- employees there before; the (plant, department) pairs they already use become plant_departments rows (by System).

-- CreateTable
CREATE TABLE "plant_departments" (
    "id" SERIAL NOT NULL,
    "plant_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "plant_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plant_departments_department_id_idx" ON "plant_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "plant_departments_plant_id_department_id_key" ON "plant_departments"("plant_id", "department_id");

-- AddForeignKey
ALTER TABLE "plant_departments" ADD CONSTRAINT "plant_departments_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_departments" ADD CONSTRAINT "plant_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: nullable first, filled below, then required
ALTER TABLE "candidates" ADD COLUMN     "plant_id" INTEGER;
ALTER TABLE "employees" ADD COLUMN     "plant_id" INTEGER;

-- Backfill: the company's first plant
UPDATE "employees" e SET "plant_id" = (
    SELECT p."id" FROM "plants" p WHERE p."company_id" = e."company_id" ORDER BY p."is_active" DESC, p."plant_code" LIMIT 1
);
UPDATE "candidates" c SET "plant_id" = (
    SELECT p."id" FROM "plants" p WHERE p."company_id" = c."company_id" ORDER BY p."is_active" DESC, p."plant_code" LIMIT 1
);

-- The (plant, department) pairs already in use run at that plant
INSERT INTO "plant_departments" ("plant_id", "department_id", "created_by_id", "updated_at", "updated_by_id")
SELECT DISTINCT x."plant_id", x."department_id", 0, CURRENT_TIMESTAMP, 0
FROM (
    SELECT "plant_id", "department_id" FROM "employees" WHERE "department_id" IS NOT NULL AND "plant_id" IS NOT NULL
    UNION
    SELECT "plant_id", "department_id" FROM "candidates" WHERE "department_id" IS NOT NULL AND "plant_id" IS NOT NULL
) x;

-- Fails here if a company with employees / candidates has no plant - give it one first
ALTER TABLE "candidates" ALTER COLUMN "plant_id" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "plant_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "candidates_plant_id_idx" ON "candidates"("plant_id");

-- CreateIndex
CREATE INDEX "employees_plant_id_idx" ON "employees"("plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "plants_id_company_id_key" ON "plants"("id", "company_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_plant_id_company_id_fkey" FOREIGN KEY ("plant_id", "company_id") REFERENCES "plants"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_plant_id_department_id_fkey" FOREIGN KEY ("plant_id", "department_id") REFERENCES "plant_departments"("plant_id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_plant_id_company_id_fkey" FOREIGN KEY ("plant_id", "company_id") REFERENCES "plants"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_plant_id_department_id_fkey" FOREIGN KEY ("plant_id", "department_id") REFERENCES "plant_departments"("plant_id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;
