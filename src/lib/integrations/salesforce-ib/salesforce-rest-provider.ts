import type { SalesforceIbProvider } from "./provider";
import type { SalesforceIbCreatePayload, SalesforceIbCreateResult } from "./types";

/**
 * Env vars reserved for a future OAuth + REST (or Composite) implementation.
 * When `SALESFORCE_IB_PROVIDER=salesforce`, we validate configuration surface only.
 */
export const SALESFORCE_REST_CONFIG_KEYS = [
  "SALESFORCE_INSTANCE_URL",
  "SALESFORCE_CLIENT_ID",
  "SALESFORCE_CLIENT_SECRET",
  "SALESFORCE_USERNAME",
  "SALESFORCE_PASSWORD",
] as const;

function missingSalesforceConfig(): string[] {
  return SALESFORCE_REST_CONFIG_KEYS.filter((k) => !process.env[k]?.trim());
}

/**
 * Production-shaped stub: returns `NOT_CONFIGURED` until all keys are present,
 * then `NOT_IMPLEMENTED` until a real client is wired (no network calls).
 */
export function createSalesforceRestProvider(): SalesforceIbProvider {
  return {
    async createIbCase(payload: SalesforceIbCreatePayload): Promise<SalesforceIbCreateResult> {
      const missing = missingSalesforceConfig();
      if (missing.length > 0) {
        return {
          ok: false,
          errorCode: "SALESFORCE_NOT_CONFIGURED",
          errorMessage: `Salesforce IB provider is selected but integration is not configured (missing: ${missing.join(", ")}).`,
          retryable: false,
          rawResponse: {
            provider: "salesforce",
            configured: false,
            missingKeys: missing,
            orchestrationCasePublicId: payload.orchestrationCasePublicId,
          },
        };
      }

      return {
        ok: false,
        errorCode: "SALESFORCE_NOT_IMPLEMENTED",
        errorMessage:
          "Salesforce Case create API is not implemented in this build. Use SALESFORCE_IB_PROVIDER=mock for demos.",
        retryable: false,
        rawResponse: {
          provider: "salesforce",
          configured: true,
          orchestrationCasePublicId: payload.orchestrationCasePublicId,
        },
      };
    },
  };
}
