-- HOD appointments start and end at a moment, on the plant's clock (the user, 2026-11-19): an HOD can be changed at once
-- or from a later day; each plant has its own time zone. Hand-written: Prisma cannot describe the overlap rule below.

-- Plants: their time zone - Asia/Kolkata, or the zone of their country (Indonesia: Jakarta - HR checks it)
ALTER TABLE "plants" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
UPDATE "plants" SET "timezone" = CASE "country_code"
    WHEN 'AE' THEN 'Asia/Dubai'
    WHEN 'BH' THEN 'Asia/Bahrain'
    WHEN 'SA' THEN 'Asia/Riyadh'
    WHEN 'IQ' THEN 'Asia/Baghdad'
    WHEN 'SG' THEN 'Asia/Singapore'
    WHEN 'ID' THEN 'Asia/Jakarta'
    WHEN 'GB' THEN 'Europe/London'
    WHEN 'MA' THEN 'Africa/Casablanca'
    WHEN 'ET' THEN 'Africa/Addis_Ababa'
    WHEN 'TZ' THEN 'Africa/Dar_es_Salaam'
    WHEN 'NG' THEN 'Africa/Lagos'
    ELSE "timezone"
  END
WHERE "country_code" <> 'IN';

-- Appointments: from a day / to a day -> from a moment / until a moment (the end not included). A first day becomes its
-- midnight at the plant, a last day the midnight after it - so the next HOD starts at the very moment the last one stops.
ALTER TABLE "hod_appointments" ADD COLUMN "starts_at" TIMESTAMPTZ(3), ADD COLUMN "ends_at" TIMESTAMPTZ(3);
UPDATE "hod_appointments" a
SET "starts_at" = a."from_date"::timestamp AT TIME ZONE p."timezone",
    "ends_at" = (a."to_date" + 1)::timestamp AT TIME ZONE p."timezone"
FROM "plant_departments" pd JOIN "plants" p ON p."id" = pd."plant_id"
WHERE pd."id" = a."post_id";
ALTER TABLE "hod_appointments" ALTER COLUMN "starts_at" SET NOT NULL;

DROP INDEX IF EXISTS "hod_appointments_one_current_per_post";
ALTER TABLE "hod_appointments" DROP COLUMN "from_date", DROP COLUMN "to_date";

-- An appointment ends after it starts ...
ALTER TABLE "hod_appointments" ADD CONSTRAINT "hod_appointments_ends_after_start" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

-- ... and two appointments of one post never overlap in time - past, current or upcoming (one HOD per post at a time).
-- btree_gist lets one rule compare the post (=) and the time ranges (&&).
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "hod_appointments" ADD CONSTRAINT "hod_appointments_no_overlap"
  EXCLUDE USING gist ("post_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&);
