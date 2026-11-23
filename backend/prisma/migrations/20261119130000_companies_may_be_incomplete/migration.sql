-- A company from the VBMS import may lack its address and state / region (and PIN, PF / ESIC codes, already optional)
-- until HR fills them in on the Organization page, which needs them all when saving (the user, 2026-11-19).

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "region" DROP NOT NULL;

