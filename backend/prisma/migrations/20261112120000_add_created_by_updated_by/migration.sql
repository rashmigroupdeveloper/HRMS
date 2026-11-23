-- Who did it: created_by_id / updated_by_id (compulsory) on every table, and <action>_by_id next to every other
-- action time. The value is the logged-in employee's id, or 0 = System (script, migration, automatic job).
-- Rows that existed before this migration get 0 (System) - who made them was not recorded.

-- AlterTable
ALTER TABLE "background_checks" ADD COLUMN     "completed_by_id" INTEGER,
ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "candidate_documents" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewed_by_id" INTEGER,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "accepted_by_id" INTEGER,
ADD COLUMN     "closed_by_id" INTEGER,
ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "joining_confirmed_by_id" INTEGER,
ADD COLUMN     "offer_sent_by_id" INTEGER,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "designations" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_addresses" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_bank_accounts" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_documents" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewed_by_id" INTEGER,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_emergency_contacts" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_identity_documents" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_onboardings" ADD COLUMN     "completed_by_id" INTEGER,
ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "declaration_accepted_by_id" INTEGER,
ADD COLUMN     "id_card_issued_by_id" INTEGER,
ADD COLUMN     "joining_formalities_completed_by_id" INTEGER,
ADD COLUMN     "payroll_updated_by_id" INTEGER,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employee_statutory" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "grades" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_account_roles" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_accounts" ADD COLUMN     "created_by_id" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by_id" INTEGER NOT NULL DEFAULT 0;

-- Existing rows: System. The default is then removed, so the code must always say who.
ALTER TABLE "background_checks" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "candidate_documents" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "candidates" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "companies" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "departments" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "designations" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employee_addresses" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employee_bank_accounts" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employee_documents" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employee_emergency_contacts" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employee_identity_documents" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employee_onboardings" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employee_statutory" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "employees" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "grades" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "locations" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "role_permissions" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "roles" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "sessions" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "user_account_roles" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;
ALTER TABLE "user_accounts" ALTER COLUMN "created_by_id" DROP DEFAULT, ALTER COLUMN "updated_by_id" DROP DEFAULT;

-- Actions already done before this migration: System
UPDATE "background_checks" SET "completed_by_id" = 0 WHERE "completed_at" IS NOT NULL;
UPDATE "candidate_documents" SET "reviewed_by_id" = 0 WHERE "reviewed_at" IS NOT NULL;
UPDATE "employee_documents" SET "reviewed_by_id" = 0 WHERE "reviewed_at" IS NOT NULL;
UPDATE "candidates" SET "offer_sent_by_id" = 0 WHERE "offer_sent_at" IS NOT NULL;
UPDATE "candidates" SET "accepted_by_id" = 0 WHERE "accepted_at" IS NOT NULL;
UPDATE "candidates" SET "closed_by_id" = 0 WHERE "closed_at" IS NOT NULL;
UPDATE "candidates" SET "joining_confirmed_by_id" = 0 WHERE "joining_confirmed_at" IS NOT NULL;
UPDATE "employee_onboardings" SET "declaration_accepted_by_id" = 0 WHERE "declaration_accepted_at" IS NOT NULL;
UPDATE "employee_onboardings" SET "joining_formalities_completed_by_id" = 0 WHERE "joining_formalities_completed_at" IS NOT NULL;
UPDATE "employee_onboardings" SET "payroll_updated_by_id" = 0 WHERE "payroll_updated_at" IS NOT NULL;
UPDATE "employee_onboardings" SET "id_card_issued_by_id" = 0 WHERE "id_card_issued_at" IS NOT NULL;
UPDATE "employee_onboardings" SET "completed_by_id" = 0 WHERE "completed_at" IS NOT NULL;
