-- Quantity moves from `Case` to `CaseAsset` (per platform line).
-- Backfill: legacy `Case.quantity` is copied to the asset row with minimum `sortOrder` only (multi-platform ambiguous).

ALTER TABLE "CaseAsset" ADD COLUMN "quantity" INTEGER;

UPDATE "CaseAsset"
SET "quantity" = (
  SELECT "c"."quantity" FROM "Case" AS "c" WHERE "c"."id" = "CaseAsset"."caseId"
)
WHERE EXISTS (
  SELECT 1 FROM "Case" AS "c2" WHERE "c2"."id" = "CaseAsset"."caseId" AND "c2"."quantity" IS NOT NULL
)
AND "sortOrder" = (
  SELECT MIN("ca"."sortOrder") FROM "CaseAsset" AS "ca" WHERE "ca"."caseId" = "CaseAsset"."caseId"
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "dealId" TEXT,
    "platform" TEXT,
    "softwareVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT,
    "assignedTeamId" TEXT,
    "extensionStartDate" DATETIME,
    "extensionEndDate" DATETIME,
    "businessJustification" TEXT NOT NULL,
    "migrationPlan" TEXT,
    "essSupportSubtype" TEXT,
    "migrationTimeline" TEXT,
    "targetReplacementProduct" TEXT,
    "hardwarePhysicalLocation" TEXT,
    "softwareDeploymentType" TEXT,
    "softwareProductFamily" TEXT,
    "softwareOnPremise" BOOLEAN,
    "softwarePerpetualLicense" BOOLEAN,
    "softwareIsApplicationSoftware" BOOLEAN,
    "softwareNotIosIosXr" BOOLEAN,
    "environmentIsProduction" BOOLEAN,
    "essEligibilityAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "partnerName" TEXT,
    "eolBulletinLink" TEXT,
    "serialNumbers" TEXT,
    "supportCoverageIndicator" TEXT,
    "hwLdosDate" DATETIME,
    "notes" TEXT,
    "routingNote" TEXT,
    "quoteBookingStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "notBookedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" (
    "id", "caseId", "requestType", "customerName", "dealId", "platform", "softwareVersion", "status", "priority",
    "requesterId", "ownerId", "assignedTeamId", "extensionStartDate", "extensionEndDate", "businessJustification",
    "migrationPlan", "essSupportSubtype", "migrationTimeline", "targetReplacementProduct", "hardwarePhysicalLocation",
    "softwareDeploymentType", "softwareProductFamily", "softwareOnPremise", "softwarePerpetualLicense", "softwareIsApplicationSoftware",
    "softwareNotIosIosXr", "environmentIsProduction", "essEligibilityAcknowledged",
    "partnerName", "eolBulletinLink", "serialNumbers", "supportCoverageIndicator", "hwLdosDate", "notes", "routingNote",
    "quoteBookingStatus", "notBookedReason", "createdAt", "updatedAt"
)
SELECT
    "id", "caseId", "requestType", "customerName", "dealId", "platform", "softwareVersion", "status", "priority",
    "requesterId", "ownerId", "assignedTeamId", "extensionStartDate", "extensionEndDate", "businessJustification",
    "migrationPlan", "essSupportSubtype", "migrationTimeline", "targetReplacementProduct", "hardwarePhysicalLocation",
    "softwareDeploymentType", "softwareProductFamily", "softwareOnPremise", "softwarePerpetualLicense", "softwareIsApplicationSoftware",
    "softwareNotIosIosXr", "environmentIsProduction", "essEligibilityAcknowledged",
    "partnerName", "eolBulletinLink", "serialNumbers", "supportCoverageIndicator", "hwLdosDate", "notes", "routingNote",
    "quoteBookingStatus", "notBookedReason", "createdAt", "updatedAt"
FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseId_key" ON "Case"("caseId");
CREATE INDEX "Case_status_idx" ON "Case"("status");
CREATE INDEX "Case_requestType_idx" ON "Case"("requestType");
CREATE INDEX "Case_assignedTeamId_idx" ON "Case"("assignedTeamId");
CREATE INDEX "Case_ownerId_idx" ON "Case"("ownerId");
CREATE INDEX "Case_requesterId_idx" ON "Case"("requesterId");
CREATE INDEX "Case_quoteBookingStatus_idx" ON "Case"("quoteBookingStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
