/*
  Warnings:

  - You are about to drop the column `is_mobile_aadhaar_linked` on the `employee_statutory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "employee_statutory" DROP COLUMN "is_mobile_aadhaar_linked",
ADD COLUMN     "aadhaar_mobile" TEXT;
