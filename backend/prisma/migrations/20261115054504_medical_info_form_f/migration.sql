-- CreateEnum
CREATE TYPE "medical_condition" AS ENUM ('ASTHMA', 'DIABETES', 'HEART_DISEASE', 'HIGH_BLOOD_PRESSURE', 'EPILEPSY', 'MENTAL_HEALTH');

-- CreateEnum
CREATE TYPE "sport" AS ENUM ('TENNIS', 'PADDLE_BALL', 'BADMINTON', 'FOOTBALL', 'BASKETBALL', 'OTHER');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'MEDICAL';

-- AlterTable
ALTER TABLE "employee_statutory" ADD COLUMN     "gratuity_husband_excluded_on" DATE,
ADD COLUMN     "gratuity_husbands_parents_not_dependent" BOOLEAN,
ADD COLUMN     "gratuity_no_family" BOOLEAN,
ADD COLUMN     "gratuity_parents_not_dependent" BOOLEAN,
ADD COLUMN     "previous_employer_contact" TEXT;

-- CreateTable
CREATE TABLE "employee_medical_info" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "conditions" "medical_condition"[],
    "other_conditions" TEXT,
    "takes_medication" BOOLEAN,
    "medications" TEXT,
    "has_physical_limitations" BOOLEAN,
    "physical_limitations" TEXT,
    "had_surgery" BOOLEAN,
    "surgeries" TEXT,
    "has_allergies" BOOLEAN,
    "allergies" TEXT,
    "family_heart_disease" TEXT,
    "family_diabetes" TEXT,
    "family_high_blood_pressure" TEXT,
    "family_cancer" TEXT,
    "family_stroke" TEXT,
    "family_mental_health" TEXT,
    "family_genetic_disorders" TEXT,
    "family_other" TEXT,
    "has_hereditary_condition" BOOLEAN,
    "hereditary_condition" TEXT,
    "needs_health_leave" BOOLEAN,
    "health_leave" TEXT,
    "smokes" BOOLEAN,
    "drinks_alcohol" BOOLEAN,
    "exercises_regularly" BOOLEAN,
    "exercise_frequency" TEXT,
    "needs_emergency_care" BOOLEAN,
    "emergency_care" TEXT,
    "sports" "sport"[],
    "other_sports" TEXT,
    "sports_frequency" TEXT,
    "consent_at" TIMESTAMPTZ(3) NOT NULL,
    "consent_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "employee_medical_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_medical_info_employee_id_key" ON "employee_medical_info"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_medical_info" ADD CONSTRAINT "employee_medical_info_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
