-- RedefineTables
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
    "partnerName" TEXT,
    "quantity" INTEGER,
    "eolBulletinLink" TEXT,
    "serialNumbers" TEXT,
    "supportCoverageIndicator" TEXT,
    "hwLdosDate" DATETIME,
    "notes" TEXT,
    "quoteBookingStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "notBookedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Case_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("assignedTeamId", "businessJustification", "caseId", "createdAt", "customerName", "dealId", "eolBulletinLink", "extensionEndDate", "extensionStartDate", "hwLdosDate", "id", "migrationPlan", "notes", "ownerId", "partnerName", "platform", "priority", "quantity", "requestType", "requesterId", "serialNumbers", "softwareVersion", "status", "supportCoverageIndicator", "updatedAt") SELECT "assignedTeamId", "businessJustification", "caseId", "createdAt", "customerName", "dealId", "eolBulletinLink", "extensionEndDate", "extensionStartDate", "hwLdosDate", "id", "migrationPlan", "notes", "ownerId", "partnerName", "platform", "priority", "quantity", "requestType", "requesterId", "serialNumbers", "softwareVersion", "status", "supportCoverageIndicator", "updatedAt" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseId_key" ON "Case"("caseId");
CREATE INDEX "Case_status_idx" ON "Case"("status");
CREATE INDEX "Case_requestType_idx" ON "Case"("requestType");
CREATE INDEX "Case_assignedTeamId_idx" ON "Case"("assignedTeamId");
CREATE INDEX "Case_ownerId_idx" ON "Case"("ownerId");
CREATE INDEX "Case_requesterId_idx" ON "Case"("requesterId");
CREATE INDEX "Case_quoteBookingStatus_idx" ON "Case"("quoteBookingStatus");
CREATE TABLE "new_CaseAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "platformName" TEXT NOT NULL,
    "serialNumbers" TEXT,
    "eolBulletinLink" TEXT,
    "hwLdosDate" DATETIME,
    "softwareVersion" TEXT,
    "buCost" REAL NOT NULL DEFAULT 0,
    "cxCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaseAsset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CaseAsset" ("caseId", "createdAt", "eolBulletinLink", "hwLdosDate", "id", "platformName", "serialNumbers", "softwareVersion", "sortOrder", "updatedAt") SELECT "caseId", "createdAt", "eolBulletinLink", "hwLdosDate", "id", "platformName", "serialNumbers", "softwareVersion", "sortOrder", "updatedAt" FROM "CaseAsset";
DROP TABLE "CaseAsset";
ALTER TABLE "new_CaseAsset" RENAME TO "CaseAsset";
CREATE INDEX "CaseAsset_caseId_idx" ON "CaseAsset"("caseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
