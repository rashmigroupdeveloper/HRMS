-- HOD posts become the plant-departments (changed with the user 2026-11-19, BACKLOG 3e): a post is one company + one of
-- its plants + one department running there - the plant_departments row itself. The hod_posts table of 2026-11-18 was
-- never used (no posts in the app database; only test data elsewhere), so its appointments are not carried over.

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_hod_post_id_fkey";

-- DropForeignKey
ALTER TABLE "hod_appointments" DROP CONSTRAINT "hod_appointments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "hod_posts" DROP CONSTRAINT "hod_posts_company_id_fkey";

-- DropForeignKey
ALTER TABLE "hod_posts" DROP CONSTRAINT "hod_posts_department_id_fkey";

-- DropForeignKey
ALTER TABLE "hod_posts" DROP CONSTRAINT "hod_posts_plant_id_company_id_fkey";

-- DropForeignKey
ALTER TABLE "hod_posts" DROP CONSTRAINT "hod_posts_plant_id_department_id_fkey";

-- the appointments pointed to hod_posts rows
DELETE FROM "hod_appointments";

-- DropTable
DROP TABLE "hod_posts";

-- every employee's HOD post: the plant-department they are placed in (none without a department)
UPDATE "employees" SET "hod_post_id" = NULL;
UPDATE "employees" e SET "hod_post_id" = pd."id"
  FROM "plant_departments" pd
  WHERE pd."plant_id" = e."plant_id" AND pd."department_id" = e."department_id";

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_hod_post_id_fkey" FOREIGN KEY ("hod_post_id") REFERENCES "plant_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hod_appointments" ADD CONSTRAINT "hod_appointments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "plant_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
