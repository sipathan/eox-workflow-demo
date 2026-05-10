import { ExternalReferenceIntegrationState, ExternalReferenceType } from "@prisma/client";

/** Default `externalSystemName` for Salesforce-backed references. */
export const SALESFORCE_EXTERNAL_SYSTEM_NAME = "Salesforce";

export function isSalesforceIbReferenceType(type: ExternalReferenceType): boolean {
  return type === ExternalReferenceType.SALESFORCE_IB;
}

export function formatIntegrationStateLabel(
  state: ExternalReferenceIntegrationState | null | undefined
): string {
  if (state == null) return "—";
  switch (state) {
    case ExternalReferenceIntegrationState.NOT_CREATED:
      return "Not created";
    case ExternalReferenceIntegrationState.READY:
      return "Ready";
    case ExternalReferenceIntegrationState.CREATED:
      return "Created";
    case ExternalReferenceIntegrationState.FAILED:
      return "Failed";
    default:
      return String(state);
  }
}
