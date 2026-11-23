-- Attendance policy (the user, 2026-11-22): the rules a day is judged by move off the shift into a policy - the grace, the
-- full / half day hours (from the first in to the last out) and the late rules. Given on the default-shift line; anyone
-- without one follows the default policy.

CREATE TABLE "attendance_policies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "grace_minutes" SMALLINT NOT NULL,
    "full_day_minutes" SMALLINT,
    "half_day_minutes" SMALLINT NOT NULL,
    "lates_per_half_day_cut" SMALLINT,
    "very_late_minutes" SMALLINT,
    "very_early_minutes" SMALLINT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,
    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_policies_name_key" ON "attendance_policies"("name");

-- The default policy "Standard", from the default shift's rules (so nothing changes today): its grace and half day; a
-- full day equal to the whole shift is kept as "the whole shift" (null). With no default shift: grace 10, half day 4h.
INSERT INTO "attendance_policies" ("name", "grace_minutes", "full_day_minutes", "half_day_minutes", "is_default", "created_by_id", "updated_at", "updated_by_id")
SELECT 'Standard',
       COALESCE(s."grace_minutes", 10),
       CASE WHEN s."id" IS NULL THEN NULL
            WHEN s."full_day_minutes" = (CASE WHEN s."end_minute" > s."start_minute" THEN s."end_minute" - s."start_minute" ELSE s."end_minute" + 1440 - s."start_minute" END) THEN NULL
            ELSE s."full_day_minutes" END,
       COALESCE(s."half_day_minutes", 240),
       true, 0, now(), 0
FROM (SELECT 1) one
LEFT JOIN "shifts" s ON s."is_default" AND s."is_active";

-- The default-shift line names its policy (empty = the default one)
ALTER TABLE "shift_assignments" ADD COLUMN "policy_id" INTEGER;
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "attendance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Why a rule made a half absent (e.g. "3rd late this month - first half absent")
ALTER TABLE "attendance_days" ADD COLUMN "note" TEXT;

-- The shift keeps only its timing (another shift's own rules, if any differed from the default's, are not kept - only the
-- seeded General existed when this was written)
ALTER TABLE "shifts" DROP COLUMN "full_day_minutes", DROP COLUMN "grace_minutes", DROP COLUMN "half_day_minutes";
