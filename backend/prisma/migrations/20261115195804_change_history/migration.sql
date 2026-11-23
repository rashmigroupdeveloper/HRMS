-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SIGN_IN', 'SIGN_IN_FAILED', 'SIGN_OUT');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'CHANGE_HISTORY';

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" "audit_action" NOT NULL,
    "model" TEXT,
    "record_id" INTEGER,
    "employee_id" INTEGER,
    "candidate_id" INTEGER,
    "source" TEXT,
    "changes" JSONB,
    "details" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "previous_hash" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_hash_key" ON "audit_logs"("hash");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_by_id_idx" ON "audit_logs"("created_by_id");

-- CreateIndex
CREATE INDEX "audit_logs_employee_id_idx" ON "audit_logs"("employee_id");

-- CreateIndex
CREATE INDEX "audit_logs_candidate_id_idx" ON "audit_logs"("candidate_id");

-- CreateIndex
CREATE INDEX "audit_logs_model_record_id_idx" ON "audit_logs"("model", "record_id");
