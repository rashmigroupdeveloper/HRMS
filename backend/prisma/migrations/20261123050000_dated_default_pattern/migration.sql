-- The default schedule pattern is dated (the user, 2026-11-23): which pattern is the default from which day, instead of a
-- flag - moving the star never changes the days before it. Today's default becomes the default from the start.

-- CreateTable
CREATE TABLE "default_pattern_changes" (
    "id" SERIAL NOT NULL,
    "effective_from" DATE NOT NULL,
    "pattern_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "default_pattern_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "default_pattern_changes_effective_from_key" ON "default_pattern_changes"("effective_from");

-- AddForeignKey
ALTER TABLE "default_pattern_changes" ADD CONSTRAINT "default_pattern_changes_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "roster_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- today's default: the default from the start
INSERT INTO "default_pattern_changes" ("effective_from", "pattern_id", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT DATE '2000-01-01', "id", now(), 0, now(), 0 FROM "roster_patterns" WHERE "is_default" ORDER BY "id" LIMIT 1;

-- AlterTable
ALTER TABLE "roster_patterns" DROP COLUMN "is_default";
