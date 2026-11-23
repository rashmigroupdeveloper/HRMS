-- Monthly credits from a month (the user, 2026-11-23): a change of a leave type's credit rules credits from the month HR
-- picks, never every month back to when the type was added. Each type so far: the month after it was added (as before).

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN "credits_from" DATE;
UPDATE "leave_types" SET "credits_from" = (date_trunc('month', "created_at" AT TIME ZONE 'UTC') + interval '1 month')::date;
ALTER TABLE "leave_types" ALTER COLUMN "credits_from" SET NOT NULL;
