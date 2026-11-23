-- Letterhead images become their own records (kept, reusable by several templates); templates point to them by id.
-- Written by hand from `prisma migrate diff` so the existing images are carried over before the old columns go.

-- CreateEnum
CREATE TYPE "letterhead_part" AS ENUM ('HEADER', 'FOOTER', 'SIGNATURE');

-- CreateTable
CREATE TABLE "letterhead_images" (
    "id" SERIAL NOT NULL,
    "part" "letterhead_part" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "letterhead_images_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "letter_templates" ADD COLUMN     "footer_image_id" INTEGER,
ADD COLUMN     "header_image_id" INTEGER,
ADD COLUMN     "signature_image_id" INTEGER;

-- Carry over the images templates already have (who uploaded them was not recorded: SYSTEM, 0)
INSERT INTO "letterhead_images" ("part", "storage_key", "file_name", "mime_type", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT DISTINCT ON (key) part::"letterhead_part", key,
       lower(part) || CASE WHEN key LIKE '%.jpg' THEN '.jpg' ELSE '.png' END,
       CASE WHEN key LIKE '%.jpg' THEN 'image/jpeg' ELSE 'image/png' END,
       CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, 0
FROM (
    SELECT 'HEADER' AS part, "header_image_key" AS key, "id" FROM "letter_templates" WHERE "header_image_key" IS NOT NULL
    UNION ALL SELECT 'FOOTER', "footer_image_key", "id" FROM "letter_templates" WHERE "footer_image_key" IS NOT NULL
    UNION ALL SELECT 'SIGNATURE', "signature_image_key", "id" FROM "letter_templates" WHERE "signature_image_key" IS NOT NULL
) AS used
ORDER BY key, "id";

UPDATE "letter_templates" t SET "header_image_id" = i."id" FROM "letterhead_images" i WHERE i."storage_key" = t."header_image_key";
UPDATE "letter_templates" t SET "footer_image_id" = i."id" FROM "letterhead_images" i WHERE i."storage_key" = t."footer_image_key";
UPDATE "letter_templates" t SET "signature_image_id" = i."id" FROM "letterhead_images" i WHERE i."storage_key" = t."signature_image_key";

-- AlterTable
ALTER TABLE "letter_templates" DROP COLUMN "footer_image_key",
DROP COLUMN "header_image_key",
DROP COLUMN "signature_image_key";

-- CreateIndex
CREATE UNIQUE INDEX "letterhead_images_storage_key_key" ON "letterhead_images"("storage_key");

-- CreateIndex
CREATE INDEX "letterhead_images_part_idx" ON "letterhead_images"("part");

-- CreateIndex
CREATE INDEX "letter_templates_header_image_id_idx" ON "letter_templates"("header_image_id");

-- CreateIndex
CREATE INDEX "letter_templates_footer_image_id_idx" ON "letter_templates"("footer_image_id");

-- CreateIndex
CREATE INDEX "letter_templates_signature_image_id_idx" ON "letter_templates"("signature_image_id");

-- AddForeignKey
ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_header_image_id_fkey" FOREIGN KEY ("header_image_id") REFERENCES "letterhead_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_footer_image_id_fkey" FOREIGN KEY ("footer_image_id") REFERENCES "letterhead_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_signature_image_id_fkey" FOREIGN KEY ("signature_image_id") REFERENCES "letterhead_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
