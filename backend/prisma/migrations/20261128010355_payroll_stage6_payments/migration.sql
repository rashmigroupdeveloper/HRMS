-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('BANK', 'CHEQUE', 'CASH');

-- CreateEnum
CREATE TYPE "payment_batch_status" AS ENUM ('OPEN', 'SENT', 'CLOSED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('IN_BATCH', 'PAID', 'RETURNED', 'REMOVED');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'PAYROLL_PAYMENTS';

-- AlterTable
ALTER TABLE "payroll_settings" ADD COLUMN     "payment_due_days" SMALLINT NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "payroll_payment_batches" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_batch_status" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "sent_by_id" INTEGER,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payments" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'IN_BATCH',
    "bank_name" TEXT,
    "account_number_encrypted" TEXT,
    "account_number_last4" VARCHAR(4),
    "ifsc" TEXT,
    "cheque_number" TEXT,
    "paid_on" DATE,
    "bank_reference" TEXT,
    "paid_at" TIMESTAMPTZ(3),
    "paid_by_id" INTEGER,
    "return_reason" TEXT,
    "returned_at" TIMESTAMPTZ(3),
    "returned_by_id" INTEGER,
    "removed_at" TIMESTAMPTZ(3),
    "removed_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payment_holds" (
    "id" SERIAL NOT NULL,
    "payroll_run_employee_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "released_at" TIMESTAMPTZ(3),
    "released_by_id" INTEGER,
    "release_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "payroll_payment_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_payment_batches_company_id_status_idx" ON "payroll_payment_batches"("company_id", "status");

-- CreateIndex
CREATE INDEX "payroll_payments_payroll_run_employee_id_idx" ON "payroll_payments"("payroll_run_employee_id");

-- CreateIndex
CREATE INDEX "payroll_payments_batch_id_idx" ON "payroll_payments"("batch_id");

-- CreateIndex
CREATE INDEX "payroll_payment_holds_payroll_run_employee_id_idx" ON "payroll_payment_holds"("payroll_run_employee_id");

-- AddForeignKey
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payroll_payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payment_holds" ADD CONSTRAINT "payroll_payment_holds_payroll_run_employee_id_fkey" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "payroll_run_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Stage 6 slice 2: at most one payment of a person is in a batch or paid at a time (a second one would pay them twice)
CREATE UNIQUE INDEX "payroll_payments_one_active" ON "payroll_payments" ("payroll_run_employee_id") WHERE "status" IN ('IN_BATCH', 'PAID');
-- at most one open hold per person
CREATE UNIQUE INDEX "payroll_payment_holds_one_open" ON "payroll_payment_holds" ("payroll_run_employee_id") WHERE "released_at" IS NULL;

ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_sent_pair" CHECK (("sent_at" IS NULL) = ("sent_by_id" IS NULL));
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_closed_pair" CHECK (("closed_at" IS NULL) = ("closed_by_id" IS NULL));
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_sent_when" CHECK ("status" = 'OPEN' OR "sent_at" IS NOT NULL OR "closed_at" IS NOT NULL);

ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_paid_together" CHECK (("paid_at" IS NULL) = ("paid_by_id" IS NULL) AND ("paid_at" IS NULL) = ("paid_on" IS NULL));
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_returned_pair" CHECK (("returned_at" IS NULL) = ("returned_by_id" IS NULL) AND ("returned_at" IS NULL) = ("return_reason" IS NULL));
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_removed_pair" CHECK (("removed_at" IS NULL) = ("removed_by_id" IS NULL));
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_status_columns" CHECK (
  ("status" <> 'PAID' OR "paid_at" IS NOT NULL)
  AND ("status" <> 'RETURNED' OR "returned_at" IS NOT NULL)
  AND ("status" <> 'REMOVED' OR "removed_at" IS NOT NULL)
);

ALTER TABLE "payroll_payment_holds" ADD CONSTRAINT "payroll_payment_holds_released_pair" CHECK (("released_at" IS NULL) = ("released_by_id" IS NULL));
ALTER TABLE "payroll_payment_holds" ADD CONSTRAINT "payroll_payment_holds_reason" CHECK (char_length(trim("reason")) >= 3);

ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_payment_due_days" CHECK ("payment_due_days" BETWEEN 0 AND 60);
