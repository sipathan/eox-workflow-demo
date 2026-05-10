import type { Priority, RequestType } from "@prisma/client";

/**
 * Payload sent to any Salesforce IB provider (mock or real).
 * Shape is stable for future REST/Composite API mapping.
 */
export type SalesforceIbCreatePayload = {
  orchestrationCaseDbId: string;
  orchestrationCasePublicId: string;
  requestType: RequestType;
  customerName: string;
  dealId: string | null;
  partnerName: string | null;
  priority: Priority;
  /** Truncated for subject/body fields in Salesforce. */
  businessJustificationSummary: string;
  /** First asset line label (platform), if any. */
  primaryAssetSummary: string | null;
  /**
   * True when an IB external reference already exists with `integrationState === FAILED`
   * (retry path). Mock provider uses this for fail-then-retry demo scenarios.
   */
  priorFailedAttempt: boolean;
};

export type SalesforceIbCreateSuccess = {
  ok: true;
  salesforceRecordId: string;
  salesforceCaseNumber: string;
  createdAt: Date;
  recordUrl: string;
  rawResponse?: Record<string, unknown>;
};

export type SalesforceIbCreateFailure = {
  ok: false;
  errorCode: string;
  errorMessage: string;
  retryable?: boolean;
  rawResponse?: Record<string, unknown>;
};

export type SalesforceIbCreateResult = SalesforceIbCreateSuccess | SalesforceIbCreateFailure;
