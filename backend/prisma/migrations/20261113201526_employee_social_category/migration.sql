/*
  Warnings:

  - You are about to drop the column `caste` on the `employees` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "social_category" AS ENUM ('GENERAL', 'EWS', 'OBC', 'SC', 'ST');

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "caste",
ADD COLUMN     "category" "social_category";
