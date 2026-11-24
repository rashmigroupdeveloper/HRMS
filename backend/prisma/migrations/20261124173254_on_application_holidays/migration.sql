-- CreateEnum
CREATE TYPE "holiday_mode" AS ENUM ('AUTOMATIC', 'ON_APPLICATION');

-- AlterTable
ALTER TABLE "holidays" ADD COLUMN     "allow_half_day" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leave_type_id" INTEGER,
ADD COLUMN     "mode" "holiday_mode" NOT NULL DEFAULT 'AUTOMATIC';

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "holidays_only" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "holidays_leave_type_id_idx" ON "holidays"("leave_type_id");

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
