-- CreateTable
CREATE TABLE "employee_layoffs" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "rejoin_date" DATE,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_layoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_layoffs_employee_id_idx" ON "employee_layoffs"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_layoffs" ADD CONSTRAINT "employee_layoffs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
