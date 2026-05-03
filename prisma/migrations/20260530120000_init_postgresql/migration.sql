-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('ACCOUNT_TEAM', 'CX_OPS', 'BU_CONTRIBUTOR', 'FINANCE_APPROVER', 'LEADERSHIP_READONLY', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('CX_OPERATIONS', 'BU_QUEUE', 'FINANCE', 'LEADERSHIP', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('EoVSS', 'EoSM', 'ESS_MSS');

-- CreateEnum
CREATE TYPE "EssMssSupportSubtype" AS ENUM ('HARDWARE', 'SOFTWARE', 'HARDWARE_AND_SOFTWARE');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('Draft', 'Submitted', 'In Review', 'Awaiting Info', 'In Progress', 'Blocked', 'Ready for Release', 'Closed', 'Rejected', 'Cancelled');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('Intake Validation', 'Eligibility Review', 'BU Review', 'BU Pricing', 'Quote Tracking', 'VAP Tracking', 'Flag Removal Tracking', 'Additional Info Request');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('Not Started', 'In Progress', 'Completed', 'Blocked', 'Not Required');

-- CreateEnum
CREATE TYPE "ExternalReferenceType" AS ENUM ('QUOTE_ID', 'VAP_ID', 'APAS_NPI');

-- CreateEnum
CREATE TYPE "QuoteBookingStatus" AS ENUM ('OPEN', 'BOOKED', 'NOT_BOOKED', 'PASSED_OVER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "externalIdentityId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TeamType" NOT NULL,
    "region" TEXT,
    "businessUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTeam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "customerName" TEXT NOT NULL,
    "dealId" TEXT,
    "platform" TEXT,
    "softwareVersion" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'Draft',
    "priority" "Priority" NOT NULL DEFAULT 'Medium',
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT,
    "assignedTeamId" TEXT,
    "extensionStartDate" TIMESTAMP(3),
    "extensionEndDate" TIMESTAMP(3),
    "businessJustification" TEXT NOT NULL,
    "migrationPlan" TEXT,
    "essSupportSubtype" "EssMssSupportSubtype",
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
    "hwLdosDate" TIMESTAMP(3),
    "notes" TEXT,
    "routingNote" TEXT,
    "quoteBookingStatus" "QuoteBookingStatus" NOT NULL DEFAULT 'OPEN',
    "notBookedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAsset" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "platformName" TEXT NOT NULL,
    "serialNumbers" TEXT,
    "eolBulletinLink" TEXT,
    "hwLdosDate" TIMESTAMP(3),
    "softwareVersion" TEXT,
    "quantity" INTEGER,
    "buCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cxCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseAssetId" TEXT,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'Not Started',
    "isRunnable" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "assignedTeamId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "blockerReason" TEXT,
    "notRequiredReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReference" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "taskId" TEXT,
    "referenceType" "ExternalReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "externalStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalIdentityId_key" ON "User"("externalIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "Team_type_idx" ON "Team"("type");

-- CreateIndex
CREATE INDEX "UserTeam_teamId_idx" ON "UserTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTeam_userId_teamId_key" ON "UserTeam"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Case_caseId_key" ON "Case"("caseId");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "Case_requestType_idx" ON "Case"("requestType");

-- CreateIndex
CREATE INDEX "Case_assignedTeamId_idx" ON "Case"("assignedTeamId");

-- CreateIndex
CREATE INDEX "Case_ownerId_idx" ON "Case"("ownerId");

-- CreateIndex
CREATE INDEX "Case_requesterId_idx" ON "Case"("requesterId");

-- CreateIndex
CREATE INDEX "Case_quoteBookingStatus_idx" ON "Case"("quoteBookingStatus");

-- CreateIndex
CREATE INDEX "CaseAsset_caseId_idx" ON "CaseAsset"("caseId");

-- CreateIndex
CREATE INDEX "Task_caseId_idx" ON "Task"("caseId");

-- CreateIndex
CREATE INDEX "Task_caseAssetId_idx" ON "Task"("caseAssetId");

-- CreateIndex
CREATE INDEX "Task_assignedTeamId_idx" ON "Task"("assignedTeamId");

-- CreateIndex
CREATE INDEX "Task_ownerId_idx" ON "Task"("ownerId");

-- CreateIndex
CREATE INDEX "Comment_caseId_idx" ON "Comment"("caseId");

-- CreateIndex
CREATE INDEX "ActivityLog_caseId_idx" ON "ActivityLog"("caseId");

-- CreateIndex
CREATE INDEX "Attachment_caseId_idx" ON "Attachment"("caseId");

-- CreateIndex
CREATE INDEX "ExternalReference_caseId_idx" ON "ExternalReference"("caseId");

-- CreateIndex
CREATE INDEX "ExternalReference_taskId_idx" ON "ExternalReference"("taskId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAsset" ADD CONSTRAINT "CaseAsset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_caseAssetId_fkey" FOREIGN KEY ("caseAssetId") REFERENCES "CaseAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

