-- Plants have no time zone of their own after all (the user, 2026-11-19): HOD appointments are read and shown in India
-- time for every plant. The appointments already stored are exact moments and stay as they are.
ALTER TABLE "plants" DROP COLUMN "timezone";
