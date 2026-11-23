-- "locations" is renamed "work_locations": it is only where an employee / candidate is placed, not linked to plants
-- (decided 2026-11-12). A rename, so every row and every link from employees / candidates is kept.
ALTER TABLE "locations" RENAME TO "work_locations";
ALTER TABLE "work_locations" RENAME CONSTRAINT "locations_pkey" TO "work_locations_pkey";
ALTER TABLE "work_locations" RENAME CONSTRAINT "locations_company_id_fkey" TO "work_locations_company_id_fkey";
ALTER INDEX "locations_company_id_idx" RENAME TO "work_locations_company_id_idx";
ALTER INDEX "locations_company_id_name_key" RENAME TO "work_locations_company_id_name_key";
ALTER SEQUENCE "locations_id_seq" RENAME TO "work_locations_id_seq";

-- Company address in separate fields, like plants: postal code, country, state / region
ALTER TABLE "companies" ADD COLUMN "postal_code" TEXT,
ADD COLUMN "country_code" CHAR(2) NOT NULL DEFAULT 'IN',
ADD COLUMN "region" TEXT;
