-- CreateEnum
CREATE TYPE "weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "shift_change_kind" AS ENUM ('CHANGE', 'SWAP');

-- CreateEnum
CREATE TYPE "shift_change_status" AS ENUM ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "punch_source" AS ENUM ('UPLOAD', 'DEVICE');

-- CreateEnum
CREATE TYPE "day_status" AS ENUM ('PRESENT', 'HALF_DAY', 'ABSENT', 'WEEKLY_OFF', 'HOLIDAY', 'MISSED_PUNCH');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'ATTENDANCE';

-- CreateTable
CREATE TABLE "shifts" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,
    "grace_minutes" SMALLINT NOT NULL,
    "break_minutes" SMALLINT NOT NULL,
    "half_day_minutes" SMALLINT NOT NULL,
    "full_day_minutes" SMALLINT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "weekly_offs" "weekday"[],
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_patterns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "roster_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_entries" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "shift_id" INTEGER,
    "published_at" TIMESTAMPTZ(3),
    "published_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_change_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "kind" "shift_change_kind" NOT NULL,
    "requested_shift_id" INTEGER,
    "swap_with_employee_id" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "shift_change_status" NOT NULL,
    "manager_id" INTEGER,
    "manager_decided_at" TIMESTAMPTZ(3),
    "manager_decided_by_id" INTEGER,
    "hr_decided_at" TIMESTAMPTZ(3),
    "hr_decided_by_id" INTEGER,
    "reject_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "shift_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" INTEGER,
    "work_location_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_uploads" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "added_count" INTEGER NOT NULL,
    "duplicate_count" INTEGER NOT NULL,
    "unmatched_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "punch_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punches" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "employee_code" TEXT NOT NULL,
    "punched_at" TIMESTAMPTZ(3) NOT NULL,
    "device" TEXT,
    "source" "punch_source" NOT NULL,
    "upload_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_days" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "shift_id" INTEGER,
    "status" "day_status" NOT NULL,
    "auto_status" "day_status" NOT NULL,
    "first_in" TIMESTAMPTZ(3),
    "last_out" TIMESTAMPTZ(3),
    "punch_count" SMALLINT NOT NULL,
    "worked_minutes" SMALLINT NOT NULL,
    "late_minutes" SMALLINT NOT NULL,
    "early_minutes" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" "day_status" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shifts_code_key" ON "shifts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_name_key" ON "shifts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_employee_id_effective_from_key" ON "shift_assignments"("employee_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "roster_patterns_name_key" ON "roster_patterns"("name");

-- CreateIndex
CREATE INDEX "roster_entries_date_idx" ON "roster_entries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "roster_entries_employee_id_date_key" ON "roster_entries"("employee_id", "date");

-- CreateIndex
CREATE INDEX "shift_change_requests_status_idx" ON "shift_change_requests"("status");

-- CreateIndex
CREATE INDEX "shift_change_requests_employee_id_date_idx" ON "shift_change_requests"("employee_id", "date");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "punches_employee_id_punched_at_idx" ON "punches"("employee_id", "punched_at");

-- CreateIndex
CREATE UNIQUE INDEX "punches_employee_code_punched_at_key" ON "punches"("employee_code", "punched_at");

-- CreateIndex
CREATE INDEX "attendance_days_date_idx" ON "attendance_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_days_employee_id_date_key" ON "attendance_days"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_corrections_employee_id_date_key" ON "attendance_corrections"("employee_id", "date");

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_swap_with_employee_id_fkey" FOREIGN KEY ("swap_with_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_requested_shift_id_fkey" FOREIGN KEY ("requested_shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punches" ADD CONSTRAINT "punches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punches" ADD CONSTRAINT "punches_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "punch_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

