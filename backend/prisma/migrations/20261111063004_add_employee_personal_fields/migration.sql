-- CreateEnum
CREATE TYPE "joining_type" AS ENUM ('REGULAR', 'CONSULTANT_INTERN', 'OVERSEAS');

-- CreateEnum
CREATE TYPE "employment_type" AS ENUM ('PERMANENT', 'CONTRACT', 'TRAINEE', 'CONSULTANT', 'APPRENTICE');

-- CreateEnum
CREATE TYPE "workforce_category" AS ENUM ('WHITE_COLLAR', 'BLUE_COLLAR');

-- CreateEnum
CREATE TYPE "marital_status" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED');

-- CreateEnum
CREATE TYPE "blood_group" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- AlterEnum
BEGIN;
CREATE TYPE "gender_new" AS ENUM ('MALE', 'FEMALE', 'TRANSGENDER');
ALTER TABLE "employees" ALTER COLUMN "gender" TYPE "gender_new" USING ("gender"::text::"gender_new");
ALTER TYPE "gender" RENAME TO "gender_old";
ALTER TYPE "gender_new" RENAME TO "gender";
DROP TYPE "public"."gender_old";
COMMIT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "blood_group" "blood_group",
ADD COLUMN     "caste" TEXT,
ADD COLUMN     "confirmation_date" DATE,
ADD COLUMN     "contract_end_date" DATE,
ADD COLUMN     "country_of_origin" CHAR(2),
ADD COLUMN     "disability_percent" INTEGER,
ADD COLUMN     "disability_type" TEXT,
ADD COLUMN     "employment_type" "employment_type" NOT NULL,
ADD COLUMN     "father_name" TEXT,
ADD COLUMN     "height_cm" INTEGER,
ADD COLUMN     "identification_mark" TEXT,
ADD COLUMN     "is_physically_disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joining_type" "joining_type" NOT NULL,
ADD COLUMN     "marital_status" "marital_status",
ADD COLUMN     "marriage_date" DATE,
ADD COLUMN     "nationality" CHAR(2),
ADD COLUMN     "probation_end_date" DATE,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "spouse_name" TEXT,
ADD COLUMN     "weight_kg" DOUBLE PRECISION,
ADD COLUMN     "workforce_category" "workforce_category" NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ONBOARDING';

