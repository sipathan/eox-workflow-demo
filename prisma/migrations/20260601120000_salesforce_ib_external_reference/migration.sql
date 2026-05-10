-- CreateEnum
CREATE TYPE "ExternalReferenceIntegrationState" AS ENUM ('NOT_CREATED', 'READY', 'CREATED', 'FAILED');

-- AlterEnum
ALTER TYPE "ExternalReferenceType" ADD VALUE 'SALESFORCE_IB';

-- AlterTable
ALTER TABLE "ExternalReference" ALTER COLUMN "referenceId" DROP NOT NULL;

ALTER TABLE "ExternalReference" ADD COLUMN "externalSystemName" TEXT,
ADD COLUMN "integrationState" "ExternalReferenceIntegrationState",
ADD COLUMN "externalKey" TEXT,
ADD COLUMN "externalRecordUrl" TEXT,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastErrorMessage" TEXT,
ADD COLUMN "integrationMetadata" JSONB;
