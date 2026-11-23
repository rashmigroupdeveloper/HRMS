-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'JOINING_TASKS';

-- AlterEnum
ALTER TYPE "candidate_status" ADD VALUE 'LOI_ACCEPTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "letter_kind" ADD VALUE 'LETTER_OF_INTENT';
ALTER TYPE "letter_kind" ADD VALUE 'APPOINTMENT_LETTER';
ALTER TYPE "letter_kind" ADD VALUE 'CONFIRMATION_LETTER';
ALTER TYPE "letter_kind" ADD VALUE 'EXPERIENCE_LETTER';
ALTER TYPE "letter_kind" ADD VALUE 'RELIEVING_LETTER';

-- DropIndex
DROP INDEX "offer_number_sequences_company_id_year_key";

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "loi_accepted_at" TIMESTAMPTZ(3),
ADD COLUMN     "loi_accepted_by_id" INTEGER,
ADD COLUMN     "loi_number" TEXT;

-- AlterTable
ALTER TABLE "offer_letters" ADD COLUMN     "kind" "letter_kind" NOT NULL DEFAULT 'OFFER_LETTER';

-- AlterTable
ALTER TABLE "offer_number_sequences" ADD COLUMN     "kind" "letter_kind" NOT NULL DEFAULT 'OFFER_LETTER';

-- CreateTable
CREATE TABLE "employee_letters" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "kind" "letter_kind" NOT NULL,
    "letter_template_id" INTEGER NOT NULL,
    "letter_number" TEXT NOT NULL,
    "letter_date" DATE NOT NULL,
    "last_working_day" DATE,
    "storage_key" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "issued_by_id" INTEGER NOT NULL,
    "emailed_to" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joining_task_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "description" TEXT,
    "due_days" SMALLINT NOT NULL,
    "joining_types" "joining_type"[],
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "joining_task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joining_tasks" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "task_type_id" INTEGER,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE NOT NULL,
    "done_at" TIMESTAMPTZ(3),
    "done_by_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "joining_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_letters_letter_number_key" ON "employee_letters"("letter_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_letters_storage_key_key" ON "employee_letters"("storage_key");

-- CreateIndex
CREATE INDEX "employee_letters_employee_id_idx" ON "employee_letters"("employee_id");

-- CreateIndex
CREATE INDEX "employee_letters_letter_template_id_idx" ON "employee_letters"("letter_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "joining_task_types_name_key" ON "joining_task_types"("name");

-- CreateIndex
CREATE INDEX "joining_tasks_employee_id_idx" ON "joining_tasks"("employee_id");

-- CreateIndex
CREATE INDEX "joining_tasks_done_at_due_date_idx" ON "joining_tasks"("done_at", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_loi_number_key" ON "candidates"("loi_number");

-- CreateIndex
CREATE UNIQUE INDEX "offer_number_sequences_company_id_kind_year_key" ON "offer_number_sequences"("company_id", "kind", "year");

-- AddForeignKey
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_letter_template_id_fkey" FOREIGN KEY ("letter_template_id") REFERENCES "letter_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joining_tasks" ADD CONSTRAINT "joining_tasks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joining_tasks" ADD CONSTRAINT "joining_tasks_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "joining_task_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

