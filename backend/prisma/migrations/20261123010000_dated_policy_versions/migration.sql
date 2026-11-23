-- Dated policy changes (the user, 2026-11-23): a policy's rules move to versions, each from a date; a day is judged by the
-- version in force on it. Each policy's rules so far become its first version, from the start (2000-01-01).

-- CreateTable
CREATE TABLE "attendance_policy_versions" (
    "id" SERIAL NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "grace_minutes" SMALLINT NOT NULL,
    "full_day_minutes" SMALLINT,
    "half_day_minutes" SMALLINT NOT NULL,
    "lates_per_half_day_cut" SMALLINT,
    "very_late_minutes" SMALLINT,
    "very_early_minutes" SMALLINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,
    CONSTRAINT "attendance_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_policy_versions_policy_id_effective_from_key" ON "attendance_policy_versions"("policy_id", "effective_from");

-- AddForeignKey
ALTER TABLE "attendance_policy_versions" ADD CONSTRAINT "attendance_policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "attendance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- the rules so far: each policy's first version
INSERT INTO "attendance_policy_versions" ("policy_id", "effective_from", "grace_minutes", "full_day_minutes", "half_day_minutes", "lates_per_half_day_cut", "very_late_minutes", "very_early_minutes", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT "id", DATE '2000-01-01', "grace_minutes", "full_day_minutes", "half_day_minutes", "lates_per_half_day_cut", "very_late_minutes", "very_early_minutes", now(), 0, now(), 0
FROM "attendance_policies";

-- AlterTable
ALTER TABLE "attendance_policies" DROP COLUMN "full_day_minutes",
DROP COLUMN "grace_minutes",
DROP COLUMN "half_day_minutes",
DROP COLUMN "lates_per_half_day_cut",
DROP COLUMN "very_early_minutes",
DROP COLUMN "very_late_minutes";
