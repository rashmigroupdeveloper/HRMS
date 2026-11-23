-- The team of a joining task type becomes a role (the user, 2026-11-20): a role that gives "Joining tasks: Edit", whose
-- name is shown as the team. The manual list order goes - types are listed by due day, then name.

-- AlterTable: the role, filled from the old team name before it is required
ALTER TABLE "joining_task_types" ADD COLUMN "role_id" INTEGER;

-- A role with the team's name that gives "Joining tasks: Edit" (or is the Super Admin role)...
UPDATE "joining_task_types" t
SET "role_id" = r."id"
FROM "roles" r
WHERE lower(r."name") = lower(trim(t."team"))
  AND (r."is_super_admin" OR EXISTS (
    SELECT 1 FROM "role_permissions" p WHERE p."role_id" = r."id" AND p."area" = 'JOINING_TASKS' AND p."level" = 'WRITE'
  ));

-- ...else the Super Admin role (always there), to be changed on the Task types page
UPDATE "joining_task_types"
SET "role_id" = (SELECT "id" FROM "roles" WHERE "is_super_admin" ORDER BY "id" LIMIT 1)
WHERE "role_id" IS NULL;

-- A default person who does not hold the role is dropped (HR picks one again)
UPDATE "joining_task_types" t
SET "default_assignee_id" = NULL
WHERE t."default_assignee_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_account_roles" ar JOIN "user_accounts" a ON a."id" = ar."account_id"
    WHERE a."employee_id" = t."default_assignee_id" AND ar."role_id" = t."role_id"
  );

ALTER TABLE "joining_task_types" ALTER COLUMN "role_id" SET NOT NULL,
DROP COLUMN "display_order",
DROP COLUMN "team";

-- AddForeignKey
ALTER TABLE "joining_task_types" ADD CONSTRAINT "joining_task_types_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
