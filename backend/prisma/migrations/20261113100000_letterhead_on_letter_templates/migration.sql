-- The letterhead moves from the companies to the letter templates (decided 2026-11-13): a template is a complete
-- letter (wording + letterhead + stamp), HR picks one when sending an offer, and each sent letter records it.
-- No company had letterhead images and no letter had been sent when this was written, so nothing is lost.

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "letterhead_footer_key",
DROP COLUMN "letterhead_header_key",
DROP COLUMN "signature_key";

-- AlterTable
ALTER TABLE "letter_templates" ADD COLUMN     "footer_image_key" TEXT,
ADD COLUMN     "header_image_key" TEXT,
ADD COLUMN     "signature_image_key" TEXT;

-- AlterTable
ALTER TABLE "offer_letters" ADD COLUMN     "letter_template_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "offer_letters_letter_template_id_idx" ON "offer_letters"("letter_template_id");

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_letter_template_id_fkey" FOREIGN KEY ("letter_template_id") REFERENCES "letter_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
