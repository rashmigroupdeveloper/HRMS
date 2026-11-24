-- Narrow the seeded structures (the user, 2026-11-24): white / blue collar only for Regular offers (always Permanent or
-- Contract); the trainee one only for Consultant & Intern trainees. Consultants, apprentices and Overseas offers get no
-- structure (HR types the breakup) until HR defines theirs.
UPDATE "salary_structures"
SET "joining_type" = 'REGULAR', "name" = 'Regular - ' || "name", "updated_at" = CURRENT_TIMESTAMP, "updated_by_id" = 0
WHERE "name" IN ('White collar', 'Blue collar') AND "joining_type" IS NULL AND "created_by_id" = 0
  AND NOT EXISTS (SELECT 1 FROM "salary_structures" o WHERE o."name" IN ('Regular - White collar', 'Regular - Blue collar'));
UPDATE "salary_structures" SET "joining_type" = 'CONSULTANT_INTERN', "updated_at" = CURRENT_TIMESTAMP, "updated_by_id" = 0
WHERE "name" = 'Trainee' AND "joining_type" IS NULL AND "created_by_id" = 0;
