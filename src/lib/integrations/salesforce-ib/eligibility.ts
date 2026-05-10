import {
  CaseStatus,
  ExternalReferenceIntegrationState,
  ExternalReferenceType,
  TaskStatus,
  TaskType,
} from "@prisma/client";

export type SalesforceIbEligibility = {
  canAttempt: boolean;
  /** UX copy when `canAttempt` is false (null when allowed). */
  blockedReason: string | null;
};

/** Inputs required to evaluate whether an EoX case may call the Salesforce IB provider. */
export type SalesforceIbEligibilityInput = {
  status: CaseStatus;
  customerName: string;
  businessJustification: string;
  assets: { platformName: string }[];
  tasks: { type: TaskType; status: TaskStatus }[];
  references: {
    referenceType: ExternalReferenceType;
    integrationState: ExternalReferenceIntegrationState | null;
    referenceId: string | null;
  }[];
};

/**
 * Minimal EoX data required before IB creation (mirrors app intake expectations):
 * - Case submitted (not Draft)
 * - Intake Validation completed
 * - Customer name and business justification present
 * - At least one platform line with a non-empty platform name
 */
export const SALESFORCE_IB_REQUIRED_CASE_FIELDS = [
  "status !== Draft",
  "Intake Validation task Completed",
  "customerName (non-empty)",
  "businessJustification (non-empty)",
  "≥1 CaseAsset with non-empty platformName",
] as const;

function primaryPlatformLine(input: SalesforceIbEligibilityInput): { platformName: string } | null {
  const line = input.assets.find((a) => a.platformName.trim().length > 0);
  return line ?? null;
}

/** True when a successful IB link already exists (idempotent guard: do not create again). */
export function hasSuccessfulSalesforceIbReference(
  references: SalesforceIbEligibilityInput["references"]
): boolean {
  const ib = references.filter((r) => r.referenceType === ExternalReferenceType.SALESFORCE_IB);
  return (
    ib.some(
      (r) =>
        r.integrationState === ExternalReferenceIntegrationState.CREATED &&
        Boolean(r.referenceId?.trim())
    ) ||
    ib.some((r) => r.integrationState == null && Boolean(r.referenceId?.trim()))
  );
}

/** True when an IB row exists in FAILED state (retry allowed). */
export function hasFailedSalesforceIbReference(
  references: SalesforceIbEligibilityInput["references"]
): boolean {
  return references.some(
    (r) =>
      r.referenceType === ExternalReferenceType.SALESFORCE_IB &&
      r.integrationState === ExternalReferenceIntegrationState.FAILED
  );
}

/** High-level UI state for the case-detail Salesforce IB card. */
export type SalesforceIbCardState = "not_created" | "ready_to_create" | "created" | "failed";

export function getSalesforceIbCardState(input: {
  references: SalesforceIbEligibilityInput["references"];
  eligibility: SalesforceIbEligibility;
  canTrigger: boolean;
}): SalesforceIbCardState {
  if (hasSuccessfulSalesforceIbReference(input.references)) return "created";
  if (hasFailedSalesforceIbReference(input.references)) return "failed";
  if (input.eligibility.canAttempt && input.canTrigger) return "ready_to_create";
  return "not_created";
}

/**
 * Centralized eligibility: workflow + data readiness + idempotency (no duplicate CREATED).
 * Does **not** check user roles — use `canTriggerSalesforceIbCaseCreation` in RBAC for that.
 */
export function evaluateSalesforceIbCreationEligibility(
  input: SalesforceIbEligibilityInput
): SalesforceIbEligibility {
  if (input.status === CaseStatus.Draft) {
    return {
      canAttempt: false,
      blockedReason: "Submit the case before creating a Salesforce IB record.",
    };
  }

  const intake = input.tasks.find((t) => t.type === TaskType.IntakeValidation);
  if (!intake || intake.status !== TaskStatus.Completed) {
    return {
      canAttempt: false,
      blockedReason: "Intake Validation must be completed before creating a Salesforce IB case.",
    };
  }

  if (!input.customerName.trim()) {
    return {
      canAttempt: false,
      blockedReason: "Customer name is required before creating a Salesforce IB case.",
    };
  }

  if (!input.businessJustification.trim()) {
    return {
      canAttempt: false,
      blockedReason: "Business justification is required before creating a Salesforce IB case.",
    };
  }

  if (!primaryPlatformLine(input)) {
    return {
      canAttempt: false,
      blockedReason: "At least one platform line with a platform name is required for Salesforce IB creation.",
    };
  }

  if (hasSuccessfulSalesforceIbReference(input.references)) {
    return {
      canAttempt: false,
      blockedReason: "A Salesforce IB case is already linked for this orchestration case.",
    };
  }

  return { canAttempt: true, blockedReason: null };
}

/** @deprecated Use `evaluateSalesforceIbCreationEligibility` with full input (includes required fields). */
export function getSalesforceIbEligibility(
  input: SalesforceIbEligibilityInput
): SalesforceIbEligibility {
  return evaluateSalesforceIbCreationEligibility(input);
}
