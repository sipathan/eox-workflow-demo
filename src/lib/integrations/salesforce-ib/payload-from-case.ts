import type { Case, CaseAsset, ExternalReference } from "@prisma/client";
import { ExternalReferenceIntegrationState, TaskStatus, TaskType } from "@prisma/client";
import type { SalesforceIbCreatePayload } from "./types";

const JUSTIFICATION_MAX = 4000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * EoX fields that feed the Salesforce IB create payload (subset of `Case` + related rows).
 * Eligibility (`evaluateSalesforceIbCreationEligibility`) must pass before calling the mapper.
 */
export type MapEoXCaseToSalesforceIbPayloadInput = {
  case: Pick<
    Case,
    | "id"
    | "caseId"
    | "requestType"
    | "customerName"
    | "dealId"
    | "partnerName"
    | "priority"
    | "businessJustification"
  >;
  tasks: { type: TaskType; status: TaskStatus }[];
  assets: Pick<CaseAsset, "platformName">[];
  /** Only `SALESFORCE_IB` rows (for `priorFailedAttempt`). */
  salesforceIbReferences: Pick<ExternalReference, "integrationState" | "referenceId">[];
};

/**
 * Maps EoX case data → provider payload. Does not re-run eligibility; call
 * `evaluateSalesforceIbCreationEligibility` on the server first.
 */
export function mapEoXCaseToSalesforceIbPayload(
  input: MapEoXCaseToSalesforceIbPayloadInput
): SalesforceIbCreatePayload {
  const priorFailedAttempt = input.salesforceIbReferences.some(
    (r) => r.integrationState === ExternalReferenceIntegrationState.FAILED
  );
  const primary = input.assets.find((a) => a.platformName.trim().length > 0);
  return {
    orchestrationCaseDbId: input.case.id,
    orchestrationCasePublicId: input.case.caseId,
    requestType: input.case.requestType,
    customerName: input.case.customerName.trim(),
    dealId: input.case.dealId?.trim() ? input.case.dealId.trim() : null,
    partnerName: input.case.partnerName?.trim() ? input.case.partnerName.trim() : null,
    priority: input.case.priority,
    businessJustificationSummary: truncate(input.case.businessJustification, JUSTIFICATION_MAX),
    primaryAssetSummary: primary?.platformName?.trim() ? primary.platformName.trim() : null,
    priorFailedAttempt,
  };
}

/** @deprecated Use `mapEoXCaseToSalesforceIbPayload` for clarity. */
export function buildSalesforceIbCreatePayload(
  input: MapEoXCaseToSalesforceIbPayloadInput
): SalesforceIbCreatePayload {
  return mapEoXCaseToSalesforceIbPayload(input);
}
