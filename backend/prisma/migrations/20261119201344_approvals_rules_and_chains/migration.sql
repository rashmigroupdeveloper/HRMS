-- Approvals (the user, 2026-11-20) - the rules Prisma cannot describe, and the starting data. Written by hand.

-- One shared chain per kind (company_id empty): Postgres treats empty values as different in a unique index, so the
-- (kind, company_id) unique of the schema does not stop two shared chains of the same kind
CREATE UNIQUE INDEX "approval_chains_one_shared" ON "approval_chains" ("kind") WHERE "company_id" IS NULL;

-- One fallback approver role at most
CREATE UNIQUE INDEX "roles_one_approval_fallback" ON "roles" ("is_approval_fallback") WHERE "is_approval_fallback";

-- Data: the "Admin" role, marked as the fallback approver (no access of its own - its holders decide approval requests
-- nobody else can, inside the data access they are given with it). A role already named Admin takes the mark.
INSERT INTO "roles" ("name", "description", "is_approval_fallback", "created_by_id", "updated_by_id", "updated_at")
VALUES (
  'Admin',
  'The fallback approver: decides approval requests nobody else can (no manager, no HOD, nobody holding a step''s role) - only for the employees inside the data access given with it.',
  true, 0, 0, CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE SET "is_approval_fallback" = true, "updated_at" = CURRENT_TIMESTAMP;

-- Data: the two shared chains to start with. They end with the "Approve job & salary changes" access (the Super Admin
-- has it), so a request can be decided on a new database before HR picks its roles ("HR", "HR Head"...) on the Roles &
-- access page. Job change: reporting manager -> Approve job & salary changes. Salary revision: reporting manager -> HOD ->
-- Approve job & salary changes, every step seeing the salary figures (the user, 2026-11-20).
WITH job AS (
  INSERT INTO "approval_chains" ("kind", "created_by_id", "updated_by_id", "updated_at")
  VALUES ('JOB_CHANGE', 0, 0, CURRENT_TIMESTAMP)
  RETURNING "id"
)
INSERT INTO "approval_chain_steps" ("chain_id", "step_no", "approver_type", "access_area", "sees_confidential", "created_by_id", "updated_by_id", "updated_at")
SELECT job."id", s."step_no", s."approver_type"::"approver_type", s."access_area"::"access_area", false, 0, 0, CURRENT_TIMESTAMP
FROM job
CROSS JOIN (VALUES (1, 'REPORTING_MANAGER', NULL), (2, 'ACCESS', 'JOB_CHANGE_APPROVAL')) AS s("step_no", "approver_type", "access_area");

WITH salary AS (
  INSERT INTO "approval_chains" ("kind", "created_by_id", "updated_by_id", "updated_at")
  VALUES ('SALARY_REVISION', 0, 0, CURRENT_TIMESTAMP)
  RETURNING "id"
)
INSERT INTO "approval_chain_steps" ("chain_id", "step_no", "approver_type", "access_area", "sees_confidential", "created_by_id", "updated_by_id", "updated_at")
SELECT salary."id", s."step_no", s."approver_type"::"approver_type", s."access_area"::"access_area", true, 0, 0, CURRENT_TIMESTAMP
FROM salary
CROSS JOIN (VALUES (1, 'REPORTING_MANAGER', NULL), (2, 'HOD', NULL), (3, 'ACCESS', 'JOB_CHANGE_APPROVAL')) AS s("step_no", "approver_type", "access_area");
