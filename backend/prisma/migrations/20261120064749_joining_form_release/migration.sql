-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "joining_form_on_acceptance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joining_form_opened_at" TIMESTAMPTZ(3),
ADD COLUMN     "joining_form_opened_by_id" INTEGER;

-- Offers accepted before this change opened the joining form at acceptance (the only behaviour then): keep it open
UPDATE "candidates"
SET "joining_form_on_acceptance" = true,
    "joining_form_opened_at" = "accepted_at",
    "joining_form_opened_by_id" = "accepted_by_id"
WHERE "accepted_at" IS NOT NULL;
