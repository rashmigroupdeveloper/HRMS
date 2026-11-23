-- CreateEnum
CREATE TYPE "employee_import_status" AS ENUM ('DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "mail_retry_status" AS ENUM ('PENDING', 'FAILED');

-- AlterEnum
ALTER TYPE "letter_kind" ADD VALUE 'SALARY_CERTIFICATE';

-- AlterTable
ALTER TABLE "employee_medical_info" ADD COLUMN     "consent_text" TEXT;

-- CreateTable
CREATE TABLE "security_settings" (
    "id" INTEGER NOT NULL,
    "max_failed_logins" SMALLINT NOT NULL,
    "lock_minutes" SMALLINT NOT NULL,
    "session_hours" SMALLINT NOT NULL,
    "min_password_length" SMALLINT NOT NULL,
    "password_history" SMALLINT NOT NULL,
    "reset_code_minutes" SMALLINT NOT NULL,
    "confirm_password_minutes" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_imports" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "employee_import_status" NOT NULL,
    "row_count" INTEGER NOT NULL,
    "created_count" INTEGER NOT NULL,
    "updated_count" INTEGER NOT NULL,
    "errors" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_retries" (
    "id" SERIAL NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message_encrypted" TEXT,
    "status" "mail_retry_status" NOT NULL,
    "attempts" SMALLINT NOT NULL,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "mail_retries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_retries_status_next_attempt_at_idx" ON "mail_retries"("status", "next_attempt_at");

