-- The attendance month lock (the user, 2026-11-22): one lock for the whole group, opened again with a reason; and the
-- attendance month's start day - RML's 26th (26th to 25th).
-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" INTEGER NOT NULL,
    "cycle_start_day" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_month_locks" (
    "id" SERIAL NOT NULL,
    "year" SMALLINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "locked_at" TIMESTAMPTZ(3) NOT NULL,
    "locked_by_id" INTEGER NOT NULL,
    "unlocked_at" TIMESTAMPTZ(3),
    "unlocked_by_id" INTEGER,
    "unlock_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "attendance_month_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_month_locks_year_month_idx" ON "attendance_month_locks"("year", "month");


-- RML's attendance month runs from the 26th to the 25th
INSERT INTO "attendance_settings" ("id", "cycle_start_day", "created_by_id", "updated_at", "updated_by_id") VALUES (1, 26, 0, now(), 0) ON CONFLICT ("id") DO NOTHING;
