-- Every employee has a department (the user, 2026-11-19) - so every employee has an HOD post (the plant-department they
-- are placed in). Candidates may still have none until they join (joining day refuses without one).
-- Fails here if an employee has no department - give each one a department of their plant first (Employees, Edit details).

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "department_id" SET NOT NULL;
