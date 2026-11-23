-- Leave (leave types, the balance ledger, applications) and regularization / on-duty requests (2026-11-22, built after the
-- old HRMS's rules - see leave.prisma and attendance.prisma).

-- CreateEnum
CREATE TYPE "regularization_kind" AS ENUM ('MISSED_PUNCH', 'ON_DUTY');

-- CreateEnum
CREATE TYPE "day_portion" AS ENUM ('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "regularization_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "leave_entry_kind" AS ENUM ('CREDIT', 'TAKEN', 'RETURNED', 'LAPSE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "leave_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "regularization_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "kind" "regularization_kind" NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "portion" "day_portion" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "regularization_status" NOT NULL,
    "approval_request_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "regularization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_paid" BOOLEAN NOT NULL,
    "credit_per_month" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "credit_after_months" SMALLINT NOT NULL DEFAULT 0,
    "max_carry_forward" DECIMAL(5,2),
    "max_per_request" DECIMAL(5,1),
    "allow_half_day" BOOLEAN NOT NULL DEFAULT true,
    "counts_off_days" BOOLEAN NOT NULL DEFAULT false,
    "genders" "gender"[] DEFAULT ARRAY[]::"gender"[],
    "employment_types" "employment_type"[] DEFAULT ARRAY[]::"employment_type"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_ledger_entries" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "kind" "leave_entry_kind" NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "period" TEXT,
    "application_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "leave_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_applications" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "from_second_half" BOOLEAN NOT NULL DEFAULT false,
    "to_first_half" BOOLEAN NOT NULL DEFAULT false,
    "days" DECIMAL(5,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "leave_status" NOT NULL,
    "approval_request_id" INTEGER NOT NULL,
    "cancel_approval_request_id" INTEGER,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regularization_requests_approval_request_id_key" ON "regularization_requests"("approval_request_id");

-- CreateIndex
CREATE INDEX "regularization_requests_employee_id_from_date_idx" ON "regularization_requests"("employee_id", "from_date");

-- CreateIndex
CREATE INDEX "regularization_requests_status_idx" ON "regularization_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_name_key" ON "leave_types"("name");

-- CreateIndex
CREATE INDEX "leave_ledger_entries_employee_id_leave_type_id_idx" ON "leave_ledger_entries"("employee_id", "leave_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_ledger_entries_employee_id_leave_type_id_kind_period_key" ON "leave_ledger_entries"("employee_id", "leave_type_id", "kind", "period");

-- CreateIndex
CREATE UNIQUE INDEX "leave_applications_approval_request_id_key" ON "leave_applications"("approval_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_applications_cancel_approval_request_id_key" ON "leave_applications"("cancel_approval_request_id");

-- CreateIndex
CREATE INDEX "leave_applications_employee_id_from_date_idx" ON "leave_applications"("employee_id", "from_date");

-- CreateIndex
CREATE INDEX "leave_applications_status_idx" ON "leave_applications"("status");

-- AddForeignKey
ALTER TABLE "regularization_requests" ADD CONSTRAINT "regularization_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularization_requests" ADD CONSTRAINT "regularization_requests_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_ledger_entries" ADD CONSTRAINT "leave_ledger_entries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "leave_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_cancel_approval_request_id_fkey" FOREIGN KEY ("cancel_approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The old HRMS's leave types with its seeded values (there "defaults pending policy sign-off" - HR changes them on the
-- Leave page; BACKLOG asks HR). Days credited on the 1st of each month; EL only after 12 months of service; ML for women,
-- up to 26 weeks; CO and ML have no monthly credit - HR gives the days (an adjustment). By System (0).
INSERT INTO "leave_types" ("code", "name", "is_paid", "credit_per_month", "credit_after_months", "max_carry_forward", "max_per_request", "allow_half_day", "counts_off_days", "genders", "created_by_id", "updated_at", "updated_by_id")
SELECT v.code, v.name, v.paid, v.credit, v.after, v.cf, v.max, v.half, v.offs, v.genders::"gender"[], 0, now(), 0
FROM (VALUES
  ('CL', 'Casual leave', true, 0.75, 0, 0::numeric, 3::numeric, true, false, '{}'),
  ('SL', 'Sick leave', true, 0.58, 0, NULL, NULL, true, false, '{}'),
  ('EL', 'Earned leave', true, 1.25, 12, 30, NULL, true, true, '{}'),
  ('CO', 'Compensatory off', true, 0, 0, NULL, NULL, true, false, '{}'),
  ('ML', 'Maternity leave', true, 0, 0, NULL, 182, false, true, '{FEMALE}'),
  ('LWP', 'Leave without pay', false, 0, 0, NULL, NULL, true, false, '{}')
) AS v(code, name, paid, credit, after, cf, max, half, offs, genders)
WHERE NOT EXISTS (SELECT 1 FROM "leave_types" t WHERE t."code" = v.code);

-- The starting chains, shared by every company - as the old HRMS: the reporting manager, 48 hours, then passed on to
-- their own manager (escalate). Changed on the Approval rules page like any chain.
INSERT INTO "approval_chains" ("kind", "company_id", "is_active", "created_by_id", "updated_at", "updated_by_id")
SELECT k.kind::"approval_kind", NULL, true, 0, now(), 0
FROM (VALUES ('LEAVE'), ('LEAVE_CANCEL'), ('REGULARIZATION'), ('ON_DUTY')) AS k(kind)
WHERE NOT EXISTS (SELECT 1 FROM "approval_chains" c WHERE c."kind" = k.kind::"approval_kind" AND c."company_id" IS NULL);

INSERT INTO "approval_chain_steps" ("chain_id", "step_no", "approver_type", "sla_hours", "on_breach", "created_by_id", "updated_at", "updated_by_id")
SELECT c."id", 1, 'REPORTING_MANAGER', 48, 'ESCALATE', 0, now(), 0
FROM "approval_chains" c
WHERE c."kind" IN ('LEAVE', 'LEAVE_CANCEL', 'REGULARIZATION', 'ON_DUTY') AND c."company_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "approval_chain_steps" x WHERE x."chain_id" = c."id");

-- "Leave" is a new area: every role with Attendance gets the same level on it, so HR can work with leave on the first day
-- (roles are then trimmed on the Roles & access page). By System (0).
INSERT INTO "role_permissions" ("role_id", "area", "level", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT rp."role_id", 'LEAVE'::"access_area", rp."level", now(), 0, now(), 0
FROM "role_permissions" rp
WHERE rp."area" = 'ATTENDANCE'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" x WHERE x."role_id" = rp."role_id" AND x."area" = 'LEAVE');
