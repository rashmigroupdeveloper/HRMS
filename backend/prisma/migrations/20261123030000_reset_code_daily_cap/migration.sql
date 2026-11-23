-- A daily cap on "forgot password" codes (2026-11-23, the review): how many were sent on the day of the last one.

-- AlterTable
ALTER TABLE "user_accounts" ADD COLUMN     "reset_codes_sent_today" SMALLINT NOT NULL DEFAULT 0;
