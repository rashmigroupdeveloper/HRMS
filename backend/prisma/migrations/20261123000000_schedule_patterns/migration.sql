-- Schedule patterns (the user, 2026-11-23): every employee follows a pattern - a repeating list of days, each a shift, its
-- first half only, or off. The fixed shift + weekly offs + half days of an assignment become a 7-day pattern (Monday
-- first); the default shift becomes the default pattern (six days of it, Sunday off).

ALTER TABLE "roster_patterns" ADD COLUMN "half_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

-- 1. the default pattern, from the default shift (or the first shift in use)
INSERT INTO "roster_patterns" ("name", "days", "half_days", "is_default", "is_active", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT s."name" || ' week', ARRAY[s."id", s."id", s."id", s."id", s."id", s."id", 0], ARRAY[]::INTEGER[], true, true, now(), 0, now(), 0
FROM "shifts" s
WHERE s."is_active"
ORDER BY s."is_default" DESC, s."id"
LIMIT 1
ON CONFLICT ("name") DO UPDATE SET "is_default" = true;

-- 2. each fixed schedule becomes a 7-day pattern, named after it ("GEN week · off SUN · half SAT")
INSERT INTO "roster_patterns" ("name", "days", "half_days", "is_default", "is_active", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT DISTINCT ON (n."name") n."name",
  ARRAY(SELECT CASE WHEN w.d = ANY(n."weekly_offs") THEN 0 ELSE n."shift_id" END
        FROM unnest(ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']::"weekday"[]) WITH ORDINALITY AS w(d, i) ORDER BY w.i),
  ARRAY(SELECT w.i::INTEGER
        FROM unnest(ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']::"weekday"[]) WITH ORDINALITY AS w(d, i)
        WHERE w.d = ANY(n."half_day_weekdays") ORDER BY w.i),
  false, true, now(), 0, now(), 0
FROM (
  SELECT a."shift_id", a."weekly_offs", a."half_day_weekdays",
    s."code" || ' week'
      || CASE WHEN cardinality(a."weekly_offs") > 0 THEN ' · off ' || array_to_string(a."weekly_offs"::TEXT[], ' ') ELSE ' · no off' END
      || CASE WHEN cardinality(a."half_day_weekdays") > 0 THEN ' · half ' || array_to_string(a."half_day_weekdays"::TEXT[], ' ') ELSE '' END AS "name"
  FROM "shift_assignments" a JOIN "shifts" s ON s."id" = a."shift_id"
  WHERE a."pattern_id" IS NULL
) n
ON CONFLICT ("name") DO NOTHING;

-- 3. those assignments point to their pattern, starting on the weekday of their start date
UPDATE "shift_assignments" a
SET "pattern_id" = p."id", "pattern_day" = EXTRACT(ISODOW FROM a."effective_from")::INTEGER
FROM "shifts" s, "roster_patterns" p
WHERE a."pattern_id" IS NULL AND s."id" = a."shift_id"
  AND p."name" = s."code" || ' week'
      || CASE WHEN cardinality(a."weekly_offs") > 0 THEN ' · off ' || array_to_string(a."weekly_offs"::TEXT[], ' ') ELSE ' · no off' END
      || CASE WHEN cardinality(a."half_day_weekdays") > 0 THEN ' · half ' || array_to_string(a."half_day_weekdays"::TEXT[], ' ') ELSE '' END;
UPDATE "shift_assignments" SET "pattern_day" = 1 WHERE "pattern_day" IS NULL;

-- DropForeignKey
ALTER TABLE "shift_assignments" DROP CONSTRAINT "shift_assignments_shift_id_fkey";

-- AlterTable
ALTER TABLE "shift_assignments" DROP COLUMN "half_day_weekdays",
DROP COLUMN "shift_id",
DROP COLUMN "weekly_offs",
ALTER COLUMN "pattern_day" SET NOT NULL,
ALTER COLUMN "pattern_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "is_default";

-- DropEnum
DROP TYPE "weekday";
