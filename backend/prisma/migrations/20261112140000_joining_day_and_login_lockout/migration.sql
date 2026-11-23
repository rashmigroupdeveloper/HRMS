-- Joining day: candidate status JOINED + link to the employee created from it; the HR representative is now
-- completedById. Login: temporary passwords (must_change_password) and lockout after wrong passwords.

-- AlterEnum
ALTER TYPE "candidate_status" ADD VALUE 'JOINED';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "employee_id" INTEGER;

-- AlterTable
ALTER TABLE "employee_onboardings" DROP COLUMN "hr_representative_name";

-- AlterTable
ALTER TABLE "user_accounts" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ(3),
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "candidates_employee_id_key" ON "candidates"("employee_id");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
