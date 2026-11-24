/*
  Warnings:

  - You are about to drop the column `company_id` on the `holidays` table. All the data in the column will be lost.
  - You are about to drop the column `work_location_id` on the `holidays` table. All the data in the column will be lost.
  - Added the required column `category_id` to the `holidays` table without a default value. This is not possible if the table is not empty.

*/
-- Holidays move into holiday lists (the user, 2026-11-24): the old ones - for every company / one company / one location,
-- without a category - are removed, as agreed ("delete test holiday" - the only one, a test); HR enters the holidays into
-- the lists again. (The development database had none left; the test database had only tests' holidays.)
DELETE FROM "holidays";

-- DropForeignKey
ALTER TABLE "holidays" DROP CONSTRAINT "holidays_company_id_fkey";

-- DropForeignKey
ALTER TABLE "holidays" DROP CONSTRAINT "holidays_work_location_id_fkey";

-- AlterTable
ALTER TABLE "holidays" DROP COLUMN "company_id",
DROP COLUMN "work_location_id",
ADD COLUMN     "category_id" INTEGER NOT NULL,
ADD COLUMN     "portion" "day_portion" NOT NULL DEFAULT 'FULL_DAY';

-- CreateTable
CREATE TABLE "holiday_list_entries" (
    "id" SERIAL NOT NULL,
    "holiday_id" INTEGER NOT NULL,
    "holiday_list_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "holiday_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holiday_list_entries_holiday_list_id_idx" ON "holiday_list_entries"("holiday_list_id");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_list_entries_holiday_id_holiday_list_id_key" ON "holiday_list_entries"("holiday_id", "holiday_list_id");

-- CreateIndex
CREATE INDEX "holidays_category_id_idx" ON "holidays"("category_id");

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "holiday_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_list_entries" ADD CONSTRAINT "holiday_list_entries_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_list_entries" ADD CONSTRAINT "holiday_list_entries_holiday_list_id_fkey" FOREIGN KEY ("holiday_list_id") REFERENCES "holiday_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
