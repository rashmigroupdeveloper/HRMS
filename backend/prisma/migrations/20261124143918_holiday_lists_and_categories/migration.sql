-- CreateEnum
CREATE TYPE "holiday_tone" AS ENUM ('NEUTRAL', 'INFO', 'GOLD', 'POSITIVE', 'WARNING', 'NEGATIVE');

-- CreateTable
CREATE TABLE "holiday_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tone" "holiday_tone" NOT NULL DEFAULT 'NEUTRAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "holiday_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_lists" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "holiday_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_default_holiday_lists" (
    "id" SERIAL NOT NULL,
    "plant_id" INTEGER NOT NULL,
    "holiday_list_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "plant_default_holiday_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holiday_categories_name_key" ON "holiday_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_lists_name_key" ON "holiday_lists"("name");

-- CreateIndex
CREATE INDEX "holiday_lists_company_id_idx" ON "holiday_lists"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "plant_default_holiday_lists_plant_id_key" ON "plant_default_holiday_lists"("plant_id");

-- CreateIndex
CREATE INDEX "plant_default_holiday_lists_holiday_list_id_idx" ON "plant_default_holiday_lists"("holiday_list_id");

-- AddForeignKey
ALTER TABLE "holiday_lists" ADD CONSTRAINT "holiday_lists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_default_holiday_lists" ADD CONSTRAINT "plant_default_holiday_lists_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_default_holiday_lists" ADD CONSTRAINT "plant_default_holiday_lists_holiday_list_id_fkey" FOREIGN KEY ("holiday_list_id") REFERENCES "holiday_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
