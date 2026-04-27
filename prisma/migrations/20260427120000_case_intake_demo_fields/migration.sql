-- AlterTable Case: optional demo / intake extension fields
ALTER TABLE "Case" ADD COLUMN "partnerName" TEXT;
ALTER TABLE "Case" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "Case" ADD COLUMN "eolBulletinLink" TEXT;
ALTER TABLE "Case" ADD COLUMN "serialNumbers" TEXT;
ALTER TABLE "Case" ADD COLUMN "supportCoverageIndicator" TEXT;
ALTER TABLE "Case" ADD COLUMN "hwLdosDate" DATETIME;
ALTER TABLE "Case" ADD COLUMN "notes" TEXT;

-- AlterTable Attachment: demo metadata for local placeholders
ALTER TABLE "Attachment" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "sizeBytes" INTEGER;
