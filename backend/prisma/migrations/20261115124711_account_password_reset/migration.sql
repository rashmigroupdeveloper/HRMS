-- AlterTable
ALTER TABLE "user_accounts" ADD COLUMN     "reset_code_failed_attempts" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "reset_code_hash" CHAR(64),
ADD COLUMN     "reset_code_sent_at" TIMESTAMPTZ(3),
ADD COLUMN     "reset_code_sent_by_id" INTEGER,
ADD COLUMN     "reset_code_valid_until" TIMESTAMPTZ(3);
