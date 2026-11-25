-- CreateEnum
CREATE TYPE "movement_report_coverage" AS ENUM ('TODAY', 'PREVIOUS_DAY');

-- CreateTable
CREATE TABLE "daily_movement_report_settings" (
    "id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "hr_head_role_id" INTEGER NOT NULL,
    "send_at_minutes" SMALLINT NOT NULL DEFAULT 540,
    "coverage" "movement_report_coverage" NOT NULL DEFAULT 'PREVIOUS_DAY',
    "send_empty" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "daily_movement_report_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "daily_movement_report_settings" ADD CONSTRAINT "daily_movement_report_settings_hr_head_role_id_fkey" FOREIGN KEY ("hr_head_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Singleton and valid IST minute-of-day, supplementing service validation.
ALTER TABLE "daily_movement_report_settings" ADD CONSTRAINT "daily_movement_report_settings_singleton" CHECK ("id" = 1);
ALTER TABLE "daily_movement_report_settings" ADD CONSTRAINT "daily_movement_report_settings_time" CHECK ("send_at_minutes" BETWEEN 0 AND 1439);
