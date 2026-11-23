-- There is always a default shift (the user, 2026-11-22): no shift is built into the code any more - employees with no
-- shift set follow the default one, a normal shift HR edits like any other and moves (the star on Attendance setup).
-- A database without an active default (its seeded General shift lost) gets General 09:00-18:00 back as the default.
INSERT INTO "shifts" ("code", "name", "start_minute", "end_minute", "break_minutes", "is_default", "is_active", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT 'GEN', 'General', 540, 1080, 0, true, true, now(), 0, now(), 0
WHERE NOT EXISTS (SELECT 1 FROM "shifts" WHERE "is_default" AND "is_active")
ON CONFLICT ("code") DO UPDATE SET "is_default" = true, "is_active" = true, "updated_at" = now(), "updated_by_id" = 0;
