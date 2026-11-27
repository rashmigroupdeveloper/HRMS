-- CreateTable
CREATE TABLE "attendance_exemptions" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "attendance_exemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_exemptions_employee_id_from_date_idx" ON "attendance_exemptions"("employee_id", "from_date");

-- AddForeignKey
ALTER TABLE "attendance_exemptions" ADD CONSTRAINT "attendance_exemptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The last day is never before the first
ALTER TABLE "attendance_exemptions" ADD CONSTRAINT "attendance_exemptions_date_order" CHECK ("to_date" IS NULL OR "to_date" >= "from_date");
