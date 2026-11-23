-- Shift changes go through the approval service (the user, 2026-11-22): the request links to its approval request;
-- who decided each step, when and why is kept there (the manager / HR columns go). No shift-change request existed
-- when this was written, so none needs moving.

-- AlterEnum
BEGIN;
CREATE TYPE "shift_change_status_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "shift_change_requests" ALTER COLUMN "status" TYPE "shift_change_status_new" USING ("status"::text::"shift_change_status_new");
ALTER TYPE "shift_change_status" RENAME TO "shift_change_status_old";
ALTER TYPE "shift_change_status_new" RENAME TO "shift_change_status";
DROP TYPE "public"."shift_change_status_old";
COMMIT;

-- AlterTable
ALTER TABLE "shift_change_requests" DROP COLUMN "hr_decided_at",
DROP COLUMN "hr_decided_by_id",
DROP COLUMN "manager_decided_at",
DROP COLUMN "manager_decided_by_id",
DROP COLUMN "manager_id",
DROP COLUMN "reject_reason",
ADD COLUMN     "approval_request_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "shift_change_requests_approval_request_id_key" ON "shift_change_requests"("approval_request_id");

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The starting chain, shared by every company - as it worked before: the reporting manager, then HR (Attendance: Edit),
-- each reminded after 72 hours. Changed on the Approval rules page like any chain.
INSERT INTO "approval_chains" ("kind", "company_id", "is_active", "created_by_id", "updated_at", "updated_by_id")
SELECT 'SHIFT_CHANGE', NULL, true, 0, now(), 0
WHERE NOT EXISTS (SELECT 1 FROM "approval_chains" WHERE "kind" = 'SHIFT_CHANGE' AND "company_id" IS NULL);

INSERT INTO "approval_chain_steps" ("chain_id", "step_no", "approver_type", "access_area", "sla_hours", "on_breach", "created_by_id", "updated_at", "updated_by_id")
SELECT c."id", s."step_no", s."approver_type"::"approver_type", s."access_area"::"access_area", 72, 'WAIT', 0, now(), 0
FROM "approval_chains" c
CROSS JOIN (VALUES (1, 'REPORTING_MANAGER', NULL), (2, 'ACCESS', 'ATTENDANCE')) AS s("step_no", "approver_type", "access_area")
WHERE c."kind" = 'SHIFT_CHANGE' AND c."company_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "approval_chain_steps" x WHERE x."chain_id" = c."id");
