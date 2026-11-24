-- Seed: the deductions on the company's payslip (the user, 2026-11-24), by System = 0; HR renames or adds more on the
-- Organization page. Skipped when a component of that name already exists.
INSERT INTO "salary_components" ("name", "kind", "display_order", "created_by_id", "updated_at", "updated_by_id")
SELECT v.name, 'DEDUCTION'::"salary_component_kind", v.display_order, 0, CURRENT_TIMESTAMP, 0
FROM (VALUES ('Employee PF', 210), ('Professional Tax', 220), ('Canteen Recovery', 230)) AS v(name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM "salary_components" s WHERE s."name" = v.name);
