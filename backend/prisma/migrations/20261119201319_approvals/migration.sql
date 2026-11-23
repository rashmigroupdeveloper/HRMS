-- CreateEnum
CREATE TYPE "approval_kind" AS ENUM ('JOB_CHANGE', 'SALARY_REVISION');

-- CreateEnum
CREATE TYPE "approval_feature" AS ENUM ('JOB_CHANGE');

-- CreateEnum
CREATE TYPE "approver_type" AS ENUM ('REPORTING_MANAGER', 'FUNCTIONAL_MANAGER', 'HOD', 'ROLE', 'ACCESS', 'FALLBACK');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "approval_step_status" AS ENUM ('WAITING', 'OPEN', 'APPROVED', 'REJECTED', 'SKIPPED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'JOB_CHANGE_APPROVAL';

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "is_approval_fallback" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "approval_chains" (
    "id" SERIAL NOT NULL,
    "kind" "approval_kind" NOT NULL,
    "company_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "approval_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_chain_steps" (
    "id" SERIAL NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "step_no" SMALLINT NOT NULL,
    "approver_type" "approver_type" NOT NULL,
    "role_id" INTEGER,
    "access_area" "access_area",
    "sees_confidential" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "approval_chain_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" SERIAL NOT NULL,
    "feature" "approval_feature" NOT NULL,
    "kinds" "approval_kind"[],
    "employee_id" INTEGER NOT NULL,
    "requested_by_id" INTEGER NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "target_company_id" INTEGER,
    "target_plant_id" INTEGER,
    "target_department_id" INTEGER,
    "held_at" TIMESTAMPTZ(3),
    "held_by_id" INTEGER,
    "held_reason" TEXT,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" INTEGER,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request_steps" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "step_no" SMALLINT NOT NULL,
    "approver_type" "approver_type" NOT NULL,
    "role_id" INTEGER,
    "role_name" TEXT,
    "access_area" "access_area",
    "sees_confidential" BOOLEAN NOT NULL DEFAULT false,
    "approver_id" INTEGER,
    "by_fallback" BOOLEAN NOT NULL DEFAULT false,
    "status" "approval_step_status" NOT NULL DEFAULT 'WAITING',
    "note" TEXT,
    "opened_at" TIMESTAMPTZ(3),
    "opened_by_id" INTEGER,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" INTEGER,
    "comment" TEXT,
    "reminded_at" TIMESTAMPTZ(3),
    "reminded_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "approval_request_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_chains_kind_company_id_key" ON "approval_chains"("kind", "company_id");

-- CreateIndex
CREATE INDEX "approval_chain_steps_role_id_idx" ON "approval_chain_steps"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_chain_steps_chain_id_step_no_key" ON "approval_chain_steps"("chain_id", "step_no");

-- CreateIndex
CREATE INDEX "approval_requests_employee_id_idx" ON "approval_requests"("employee_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_requested_by_id_idx" ON "approval_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "approval_request_steps_status_idx" ON "approval_request_steps"("status");

-- CreateIndex
CREATE INDEX "approval_request_steps_approver_id_idx" ON "approval_request_steps"("approver_id");

-- CreateIndex
CREATE INDEX "approval_request_steps_role_id_idx" ON "approval_request_steps"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_request_steps_request_id_step_no_key" ON "approval_request_steps"("request_id", "step_no");

-- AddForeignKey
ALTER TABLE "approval_chains" ADD CONSTRAINT "approval_chains_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_chain_steps" ADD CONSTRAINT "approval_chain_steps_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "approval_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_chain_steps" ADD CONSTRAINT "approval_chain_steps_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
