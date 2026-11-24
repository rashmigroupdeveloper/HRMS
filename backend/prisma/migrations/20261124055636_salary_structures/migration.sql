-- CreateEnum
CREATE TYPE "salary_calc_method" AS ENUM ('PERCENT_OF_CTC', 'PERCENT_OF_GROSS', 'PERCENT_OF_BASIC', 'FIXED', 'BALANCE');

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "joining_type" "joining_type",
    "employment_type" "employment_type",
    "workforce_category" "workforce_category",
    "basic_component_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structure_lines" (
    "id" SERIAL NOT NULL,
    "structure_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "method" "salary_calc_method" NOT NULL,
    "value" DECIMAL(10,2),
    "minimum_base" INTEGER,
    "only_if_gross_at_most" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "salary_structure_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_name_key" ON "salary_structures"("name");

-- CreateIndex
CREATE INDEX "salary_structures_basic_component_id_idx" ON "salary_structures"("basic_component_id");

-- CreateIndex
CREATE INDEX "salary_structure_lines_salary_component_id_idx" ON "salary_structure_lines"("salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structure_lines_structure_id_salary_component_id_key" ON "salary_structure_lines"("structure_id", "salary_component_id");

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_basic_component_id_fkey" FOREIGN KEY ("basic_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structure_lines" ADD CONSTRAINT "salary_structure_lines_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "salary_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structure_lines" ADD CONSTRAINT "salary_structure_lines_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed (the user, 2026-11-24), by System = 0; HR changes them on the Organization page.
-- Two new components: a trainee's stipend, and the project allowance HR adds by hand (in no structure).
INSERT INTO "salary_components" ("name", "kind", "display_order", "created_by_id", "updated_at", "updated_by_id")
SELECT v.name, 'EARNING'::"salary_component_kind", v.display_order, 0, CURRENT_TIMESTAMP, 0
FROM (VALUES ('Stipend', 5), ('Project Allowance', 95)) AS v(name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM "salary_components" s WHERE s."name" = v.name);

-- The three structures of HR's "CTC Structure" sheet: white collar, blue collar (any employment type), trainee.
INSERT INTO "salary_structures" ("name", "employment_type", "workforce_category", "basic_component_id", "created_by_id", "updated_at", "updated_by_id")
SELECT v.name, v.employment_type::"employment_type", v.category::"workforce_category",
       (SELECT id FROM "salary_components" WHERE "name" = v.basic), 0, CURRENT_TIMESTAMP, 0
FROM (VALUES
  ('White collar', NULL, 'WHITE_COLLAR', 'Basic'),
  ('Blue collar', NULL, 'BLUE_COLLAR', 'Basic'),
  ('Trainee', 'TRAINEE', NULL, NULL)
) AS v(name, employment_type, category, basic)
WHERE NOT EXISTS (SELECT 1 FROM "salary_structures" s WHERE s."name" = v.name);

-- Their lines (a line whose component was renamed or removed is skipped)
INSERT INTO "salary_structure_lines" ("structure_id", "salary_component_id", "method", "value", "minimum_base", "only_if_gross_at_most", "created_by_id", "updated_at", "updated_by_id")
SELECT st.id, c.id, v.method::"salary_calc_method", v.value, v.minimum_base, v.gross_at_most, 0, CURRENT_TIMESTAMP, 0
FROM (VALUES
  ('White collar', 'Basic', 'PERCENT_OF_GROSS', 50.00, NULL, NULL),
  ('White collar', 'HRA', 'PERCENT_OF_BASIC', 50.00, NULL, NULL),
  ('White collar', 'Bonus', 'PERCENT_OF_BASIC', 8.33, 7000, NULL),
  ('White collar', 'Education Allowance', 'FIXED', 200.00, NULL, NULL),
  ('White collar', 'Medical', 'FIXED', 1250.00, NULL, NULL),
  ('White collar', 'Special Allowance', 'BALANCE', NULL, NULL, NULL),
  ('White collar', 'Employer Contribution to PF', 'PERCENT_OF_BASIC', 12.00, NULL, NULL),
  ('White collar', 'Employer Contribution to Gratuity', 'PERCENT_OF_BASIC', 4.81, NULL, NULL),
  ('White collar', 'Employer Contribution to ESI', 'PERCENT_OF_BASIC', 3.25, NULL, 21000),
  ('Blue collar', 'Basic', 'PERCENT_OF_GROSS', 50.00, NULL, NULL),
  ('Blue collar', 'HRA', 'PERCENT_OF_BASIC', 50.00, NULL, NULL),
  ('Blue collar', 'Bonus', 'PERCENT_OF_BASIC', 8.33, 7000, NULL),
  ('Blue collar', 'Special Allowance', 'BALANCE', NULL, NULL, NULL),
  ('Blue collar', 'Employer Contribution to PF', 'PERCENT_OF_BASIC', 12.00, NULL, NULL),
  ('Blue collar', 'Employer Contribution to Gratuity', 'PERCENT_OF_BASIC', 4.81, NULL, NULL),
  ('Blue collar', 'Employer Contribution to ESI', 'PERCENT_OF_BASIC', 3.25, NULL, 21000),
  ('Trainee', 'Stipend', 'BALANCE', NULL, NULL, NULL)
) AS v(structure, component, method, value, minimum_base, gross_at_most)
JOIN "salary_structures" st ON st."name" = v.structure
JOIN "salary_components" c ON c."name" = v.component
ON CONFLICT ("structure_id", "salary_component_id") DO NOTHING;
