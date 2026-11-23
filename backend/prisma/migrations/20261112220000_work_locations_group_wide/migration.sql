-- Work locations become one group-wide list (decided 2026-11-12): a site can be used by several companies, and the
-- employee / candidate already has its own company. Names are now unique across the group.

-- DropForeignKey
ALTER TABLE "work_locations" DROP CONSTRAINT "work_locations_company_id_fkey";

-- DropIndex
DROP INDEX "work_locations_company_id_idx";

-- DropIndex
DROP INDEX "work_locations_company_id_name_key";

-- AlterTable
ALTER TABLE "work_locations" DROP COLUMN "company_id";

-- CreateIndex
CREATE UNIQUE INDEX "work_locations_name_key" ON "work_locations"("name");
