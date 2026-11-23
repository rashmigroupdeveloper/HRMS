-- VBMS masters (decided 2026-11-12): SAP company code on companies, a code on departments, address fields on plants.
-- Plants are no longer linked to locations (a location is where employees are placed).

-- DropForeignKey
ALTER TABLE "plants" DROP CONSTRAINT "plants_location_id_fkey";

-- DropIndex
DROP INDEX "plants_location_id_idx";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "sap_company_code" TEXT;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "code" TEXT;
-- Existing departments: the code starts as the name (VBMS uses the same style for many codes); HR can change it
UPDATE "departments" SET "code" = "name";
ALTER TABLE "departments" ALTER COLUMN "code" SET NOT NULL;

-- AlterTable
ALTER TABLE "plants" DROP COLUMN "location_id",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "country_code" CHAR(2) NOT NULL DEFAULT 'IN',
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "region" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "companies_sap_company_code_key" ON "companies"("sap_company_code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
