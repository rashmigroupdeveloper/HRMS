-- Comp-off claims (the user, 2026-11-22): an employee who worked on a weekly off / holiday claims comp-off; approved, the
-- days are credited to the comp-off leave type and expire 90 days after the day worked.

-- AlterTable
ALTER TABLE "leave_ledger_entries" ADD COLUMN     "comp_off_claim_id" INTEGER,
ADD COLUMN     "expires_on" DATE;

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "is_comp_off" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "comp_off_claims" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "days" DECIMAL(3,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "leave_status" NOT NULL,
    "approval_request_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "comp_off_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comp_off_claims_approval_request_id_key" ON "comp_off_claims"("approval_request_id");

-- CreateIndex
CREATE INDEX "comp_off_claims_employee_id_work_date_idx" ON "comp_off_claims"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_ledger_entries_comp_off_claim_id_key" ON "leave_ledger_entries"("comp_off_claim_id");

-- AddForeignKey
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_comp_off_claim_id_fkey" FOREIGN KEY ("comp_off_claim_id") REFERENCES "comp_off_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_claims" ADD CONSTRAINT "comp_off_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_claims" ADD CONSTRAINT "comp_off_claims_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The seeded Compensatory off (CO) receives comp-off; it was "given by HR" until now
UPDATE "leave_types" SET "is_comp_off" = true, "updated_at" = now(), "updated_by_id" = 0
WHERE "code" = 'CO' AND NOT EXISTS (SELECT 1 FROM "leave_types" WHERE "is_comp_off");

-- The starting chain, shared by every company: the reporting manager, 48 hours, then their manager (as leave)
INSERT INTO "approval_chains" ("kind", "company_id", "is_active", "created_by_id", "updated_at", "updated_by_id")
SELECT 'COMP_OFF', NULL, true, 0, now(), 0
WHERE NOT EXISTS (SELECT 1 FROM "approval_chains" WHERE "kind" = 'COMP_OFF' AND "company_id" IS NULL);

INSERT INTO "approval_chain_steps" ("chain_id", "step_no", "approver_type", "sla_hours", "on_breach", "created_by_id", "updated_at", "updated_by_id")
SELECT c."id", 1, 'REPORTING_MANAGER', 48, 'ESCALATE', 0, now(), 0
FROM "approval_chains" c
WHERE c."kind" = 'COMP_OFF' AND c."company_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "approval_chain_steps" x WHERE x."chain_id" = c."id");
