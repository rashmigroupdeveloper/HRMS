-- Roles become data: roles, role_permissions (level per area), user_account_roles (several roles per login).
-- Replaces the fixed "role" column (EMPLOYEE / HR) on user_accounts.

-- CreateEnum
CREATE TYPE "access_area" AS ENUM ('ONBOARDING', 'EMPLOYEES', 'ORGANIZATION', 'ACCESS');

-- CreateEnum
CREATE TYPE "access_level" AS ENUM ('READ', 'WRITE');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "area" "access_area" NOT NULL,
    "level" "access_level" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account_roles" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_account_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_area_key" ON "role_permissions"("role_id", "area");

-- CreateIndex
CREATE INDEX "user_account_roles_role_id_idx" ON "user_account_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_roles_account_id_role_id_key" ON "user_account_roles"("account_id", "role_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_roles" ADD CONSTRAINT "user_account_roles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_roles" ADD CONSTRAINT "user_account_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: the built-in Super Admin role (all access, cannot be changed or deleted)
INSERT INTO "roles" ("name", "description", "is_super_admin", "updated_at")
VALUES ('Super Admin', 'Full access to everything, including roles. Built in - cannot be changed or deleted.', true, CURRENT_TIMESTAMP);

-- Data: the old fixed HR role becomes an ordinary role with the access it had
INSERT INTO "roles" ("name", "description", "updated_at")
VALUES ('HR', 'Onboarding and organization masters; can view employee records.', CURRENT_TIMESTAMP);

INSERT INTO "role_permissions" ("role_id", "area", "level", "updated_at")
SELECT r."id", p."area"::"access_area", p."level"::"access_level", CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN (VALUES ('ONBOARDING', 'WRITE'), ('ORGANIZATION', 'WRITE'), ('EMPLOYEES', 'READ')) AS p("area", "level")
WHERE r."name" = 'HR';

-- Data: logins that had the HR role keep it
INSERT INTO "user_account_roles" ("account_id", "role_id", "updated_at")
SELECT a."id", r."id", CURRENT_TIMESTAMP
FROM "user_accounts" a
JOIN "roles" r ON r."name" = 'HR'
WHERE a."role" = 'HR';

-- AlterTable
ALTER TABLE "user_accounts" DROP COLUMN "role";

-- DropEnum
DROP TYPE "role";
