-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'HOD_APPOINTMENTS';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "hod_post_id" INTEGER;

-- CreateTable
CREATE TABLE "hod_posts" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "plant_id" INTEGER,
    "department_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "hod_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hod_appointments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "hod_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hod_posts_company_id_idx" ON "hod_posts"("company_id");

-- CreateIndex
CREATE INDEX "hod_posts_plant_id_department_id_idx" ON "hod_posts"("plant_id", "department_id");

-- CreateIndex
CREATE INDEX "hod_appointments_post_id_idx" ON "hod_appointments"("post_id");

-- CreateIndex
CREATE INDEX "hod_appointments_employee_id_idx" ON "hod_appointments"("employee_id");

-- CreateIndex
CREATE INDEX "employees_hod_post_id_idx" ON "employees"("hod_post_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_hod_post_id_fkey" FOREIGN KEY ("hod_post_id") REFERENCES "hod_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hod_posts" ADD CONSTRAINT "hod_posts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hod_posts" ADD CONSTRAINT "hod_posts_plant_id_company_id_fkey" FOREIGN KEY ("plant_id", "company_id") REFERENCES "plants"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hod_posts" ADD CONSTRAINT "hod_posts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hod_posts" ADD CONSTRAINT "hod_posts_plant_id_department_id_fkey" FOREIGN KEY ("plant_id", "department_id") REFERENCES "plant_departments"("plant_id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hod_appointments" ADD CONSTRAINT "hod_appointments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "hod_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hod_appointments" ADD CONSTRAINT "hod_appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

