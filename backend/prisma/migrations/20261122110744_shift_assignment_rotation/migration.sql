-- AlterTable
ALTER TABLE "shift_assignments" ADD COLUMN     "pattern_day" SMALLINT,
ADD COLUMN     "pattern_id" INTEGER;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "roster_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
