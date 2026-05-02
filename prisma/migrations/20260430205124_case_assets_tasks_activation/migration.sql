-- CreateTable
CREATE TABLE "CaseAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "platformName" TEXT NOT NULL,
    "serialNumbers" TEXT,
    "eolBulletinLink" TEXT,
    "hwLdosDate" DATETIME,
    "softwareVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaseAsset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "caseAssetId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "isRunnable" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" DATETIME,
    "ownerId" TEXT,
    "assignedTeamId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" DATETIME,
    "notes" TEXT,
    "blockerReason" TEXT,
    "notRequiredReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_caseAssetId_fkey" FOREIGN KEY ("caseAssetId") REFERENCES "CaseAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assignedTeamId", "blockerReason", "caseId", "createdAt", "dueDate", "id", "isRequired", "notRequiredReason", "notes", "ownerId", "status", "type", "updatedAt") SELECT "assignedTeamId", "blockerReason", "caseId", "createdAt", "dueDate", "id", "isRequired", "notRequiredReason", "notes", "ownerId", "status", "type", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_caseId_idx" ON "Task"("caseId");
CREATE INDEX "Task_caseAssetId_idx" ON "Task"("caseAssetId");
CREATE INDEX "Task_assignedTeamId_idx" ON "Task"("assignedTeamId");
CREATE INDEX "Task_ownerId_idx" ON "Task"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CaseAsset_caseId_idx" ON "CaseAsset"("caseId");

-- Backfill: legacy tasks had no activation model — treat them as runnable from creation time.
UPDATE "Task" SET "isRunnable" = 1, "activatedAt" = COALESCE("activatedAt", "createdAt");

-- Backfill: one CaseAsset per existing case from legacy platform fields (if any platform text exists).
INSERT INTO "CaseAsset" ("id", "caseId", "sortOrder", "platformName", "serialNumbers", "eolBulletinLink", "hwLdosDate", "softwareVersion", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(16))) || lower(hex(randomblob(8))),
  "c"."id",
  0,
  COALESCE(NULLIF(TRIM("c"."platform"), ''), 'Unspecified platform'),
  "c"."serialNumbers",
  "c"."eolBulletinLink",
  "c"."hwLdosDate",
  "c"."softwareVersion",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Case" AS "c"
WHERE NOT EXISTS (SELECT 1 FROM "CaseAsset" AS "a" WHERE "a"."caseId" = "c"."id");
