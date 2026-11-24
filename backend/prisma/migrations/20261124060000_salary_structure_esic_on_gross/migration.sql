-- Employer ESI is 3.25% of the GROSS (the law; HR's sheet divides by 2.2331 = 2 x (1.08405 + 3.25%), which only works
-- out with ESIC on the gross - its ESIC cell's "% of Basic" is a slip). Fixes the seed of the previous migration.
UPDATE "salary_structure_lines" l
SET "method" = 'PERCENT_OF_GROSS', "updated_at" = CURRENT_TIMESTAMP, "updated_by_id" = 0
FROM "salary_structures" s, "salary_components" c
WHERE l."structure_id" = s."id" AND l."salary_component_id" = c."id"
  AND s."name" IN ('White collar', 'Blue collar') AND c."name" = 'Employer Contribution to ESI'
  AND l."method" = 'PERCENT_OF_BASIC' AND l."created_by_id" = 0;
