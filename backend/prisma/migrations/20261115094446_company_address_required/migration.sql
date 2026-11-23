/*
  Warnings:

  - Made the column `address` on table `companies` required. This step will fail if there are existing NULL values in that column.
  - Made the column `region` on table `companies` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "region" SET NOT NULL;
