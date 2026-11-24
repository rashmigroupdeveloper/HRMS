-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "max_days_back" SMALLINT,
ADD COLUMN     "notice_days" SMALLINT,
ADD COLUMN     "today_or_past_only" BOOLEAN NOT NULL DEFAULT false;
