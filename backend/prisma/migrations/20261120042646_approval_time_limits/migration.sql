-- CreateEnum
CREATE TYPE "approval_breach_action" AS ENUM ('WAIT', 'ESCALATE', 'AUTO_APPROVE', 'EXPIRE', 'AUTO_REJECT');

-- AlterEnum
ALTER TYPE "approval_status" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "approval_step_status" ADD VALUE 'ESCALATED';

-- AlterEnum
ALTER TYPE "approver_type" ADD VALUE 'ESCALATION';

-- AlterTable
ALTER TABLE "approval_chain_steps" ADD COLUMN     "escalate_role_id" INTEGER,
ADD COLUMN     "on_breach" "approval_breach_action" NOT NULL DEFAULT 'WAIT',
ADD COLUMN     "sla_hours" SMALLINT;

-- AlterTable
ALTER TABLE "approval_request_steps" ADD COLUMN     "auto_decided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breached_at" TIMESTAMPTZ(3),
ADD COLUMN     "breached_by_id" INTEGER,
ADD COLUMN     "due_at" TIMESTAMPTZ(3),
ADD COLUMN     "escalate_role_id" INTEGER,
ADD COLUMN     "escalate_role_name" TEXT,
ADD COLUMN     "on_breach" "approval_breach_action" NOT NULL DEFAULT 'WAIT',
ADD COLUMN     "sla_hours" SMALLINT;

-- CreateIndex
CREATE INDEX "approval_chain_steps_escalate_role_id_idx" ON "approval_chain_steps"("escalate_role_id");

-- CreateIndex
CREATE INDEX "approval_request_steps_due_at_idx" ON "approval_request_steps"("due_at");

-- AddForeignKey
ALTER TABLE "approval_chain_steps" ADD CONSTRAINT "approval_chain_steps_escalate_role_id_fkey" FOREIGN KEY ("escalate_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
