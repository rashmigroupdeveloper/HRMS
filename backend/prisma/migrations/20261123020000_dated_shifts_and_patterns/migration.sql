-- Dated shifts and schedule patterns (the user, 2026-11-23 - the review found that editing a shift or a pattern reworked
-- days already passed): a shift's timing and a pattern's days move to versions, each from a date, like the attendance
-- policies; a day follows the version in force on it. What each has now becomes its first version, from the start
-- (2000-01-01).

-- CreateTable
CREATE TABLE "shift_versions" (
    "id" SERIAL NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,
    "break_minutes" SMALLINT NOT NULL,
    "half_split_minute" SMALLINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "shift_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_pattern_versions" (
    "id" SERIAL NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "days" INTEGER[],
    "half_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "roster_pattern_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_versions_shift_id_effective_from_key" ON "shift_versions"("shift_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "roster_pattern_versions_pattern_id_effective_from_key" ON "roster_pattern_versions"("pattern_id", "effective_from");

-- AddForeignKey
ALTER TABLE "shift_versions" ADD CONSTRAINT "shift_versions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pattern_versions" ADD CONSTRAINT "roster_pattern_versions_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "roster_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- what each has now: its first version
INSERT INTO "shift_versions" ("shift_id", "effective_from", "start_minute", "end_minute", "break_minutes", "half_split_minute", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT "id", DATE '2000-01-01', "start_minute", "end_minute", "break_minutes", "half_split_minute", now(), 0, now(), 0
FROM "shifts";

INSERT INTO "roster_pattern_versions" ("pattern_id", "effective_from", "days", "half_days", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT "id", DATE '2000-01-01', "days", "half_days", now(), 0, now(), 0
FROM "roster_patterns";

-- AlterTable
ALTER TABLE "roster_patterns" DROP COLUMN "days",
DROP COLUMN "half_days";

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "break_minutes",
DROP COLUMN "end_minute",
DROP COLUMN "half_split_minute",
DROP COLUMN "start_minute";
