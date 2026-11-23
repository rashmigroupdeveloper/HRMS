-- Half-day sessions (the user, 2026-11-22 - RML's Saturday is a half day): each day has a first and a second half.

-- A shift's halves: where the first half ends (null: the middle of the shift)
ALTER TABLE "shifts" ADD COLUMN "half_split_minute" SMALLINT;

-- The weekdays when only the first half is worked (the second half is a weekly off)
ALTER TABLE "shift_assignments" ADD COLUMN "half_day_weekdays" "weekday"[] DEFAULT ARRAY[]::"weekday"[];

-- Each day's halves. Added empty, filled from the day's status, then required. A day worked out as "half day" did not
-- record which half was worked - first half present, second absent is assumed (none existed in the development database
-- when this was written); every day is worked out again by the app afterwards, from its punches.
ALTER TABLE "attendance_days" ADD COLUMN "first_half" "day_status", ADD COLUMN "second_half" "day_status";
UPDATE "attendance_days" SET
  "first_half" = CASE WHEN "status" = 'HALF_DAY' THEN 'PRESENT'::"day_status" ELSE "status" END,
  "second_half" = CASE WHEN "status" = 'HALF_DAY' THEN 'ABSENT'::"day_status" ELSE "status" END;
ALTER TABLE "attendance_days" ALTER COLUMN "first_half" SET NOT NULL, ALTER COLUMN "second_half" SET NOT NULL;

-- HR's corrections set a half (or both): an existing correction sets both halves to its status (a "half day" one: first
-- half present, second absent - the same guess; none existed in the development database when this was written).
ALTER TABLE "attendance_corrections" ADD COLUMN "first_half" "day_status", ADD COLUMN "second_half" "day_status";
UPDATE "attendance_corrections" SET
  "first_half" = CASE WHEN "status" = 'HALF_DAY' THEN 'PRESENT'::"day_status" ELSE "status" END,
  "second_half" = CASE WHEN "status" = 'HALF_DAY' THEN 'ABSENT'::"day_status" ELSE "status" END;
ALTER TABLE "attendance_corrections" DROP COLUMN "status";
