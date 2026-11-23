-- The fields of the old HRMS masters (decided 2026-11-12): company e-code prefix, India payroll, PAN, TAN, GSTIN,
-- PT registration; location state code and time zone; grade code and rank; new tables plants and cost_centers.
-- (Org units are deliberately not carried over.)

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "ecode_prefix" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "is_india_payroll" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "pt_registration_no" TEXT,
ADD COLUMN     "tan" TEXT;

-- AlterTable
ALTER TABLE "grades" ADD COLUMN     "code" TEXT,
ADD COLUMN     "rank" SMALLINT;

-- Existing rows: the e-code prefix is the company code (as in the old HRMS); grades get a placeholder code / rank
UPDATE "companies" SET "ecode_prefix" = "code";
UPDATE "grades" SET "code" = 'G' || "id", "rank" = 0;
ALTER TABLE "companies" ALTER COLUMN "ecode_prefix" SET NOT NULL;
ALTER TABLE "grades" ALTER COLUMN "code" SET NOT NULL, ALTER COLUMN "rank" SET NOT NULL;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "state_code" CHAR(2),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "plants" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "plant_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plant_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plants_location_id_idx" ON "plants"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "plants_company_id_plant_code_key" ON "plants"("company_id", "plant_code");

-- CreateIndex
CREATE INDEX "cost_centers_plant_id_idx" ON "cost_centers"("plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_company_id_code_key" ON "cost_centers"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "companies_ecode_prefix_key" ON "companies"("ecode_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "grades_code_key" ON "grades"("code");

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
