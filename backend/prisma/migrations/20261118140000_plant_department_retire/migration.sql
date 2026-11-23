-- A plant-department link can be retired (2026-11-18): nobody new is placed in it, the people already placed keep it
-- AlterTable
ALTER TABLE "plant_departments" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
