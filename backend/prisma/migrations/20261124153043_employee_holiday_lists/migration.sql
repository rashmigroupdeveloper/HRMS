-- CreateTable
CREATE TABLE "employee_holiday_lists" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "holiday_list_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_holiday_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_holiday_lists_holiday_list_id_idx" ON "employee_holiday_lists"("holiday_list_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_holiday_lists_employee_id_effective_from_key" ON "employee_holiday_lists"("employee_id", "effective_from");

-- AddForeignKey
ALTER TABLE "employee_holiday_lists" ADD CONSTRAINT "employee_holiday_lists_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_holiday_lists" ADD CONSTRAINT "employee_holiday_lists_holiday_list_id_fkey" FOREIGN KEY ("holiday_list_id") REFERENCES "holiday_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
