import { createHash } from "node:crypto";
import type { SalesforceIbProvider } from "./provider";
import type { SalesforceIbCreatePayload, SalesforceIbCreateResult } from "./types";

/** Default seed so the same public case id always maps to the same mock SF ids after reseed. */
const DEFAULT_STABILITY_SEED = "eox-workflow-demo-ib-v1";

/** Demo: these public case ids fail on the first provider call; retry succeeds (requires `priorFailedAttempt`). */
export const DEFAULT_MOCK_FAIL_FIRST_ATTEMPT_PUBLIC_CASE_IDS = ["EoVSS-2026-200015"] as const;

const SF_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

function stabilitySeed(): string {
  return process.env.SALESFORCE_IB_MOCK_STABILITY_SEED?.trim() || DEFAULT_STABILITY_SEED;
}

function failFirstAttemptPublicCaseIds(): string[] {
  const raw = process.env.SALESFORCE_IB_MOCK_FAIL_FIRST_ATTEMPT_IDS?.trim();
  if (!raw) return [...DEFAULT_MOCK_FAIL_FIRST_ATTEMPT_PUBLIC_CASE_IDS];
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : [...DEFAULT_MOCK_FAIL_FIRST_ATTEMPT_PUBLIC_CASE_IDS];
}

function digestForCase(publicCaseId: string): Buffer {
  return createHash("sha256").update(`${stabilitySeed()}\n${publicCaseId}\n`).digest();
}

function toSalesforceLikeRecordId(buf: Buffer): string {
  const prefix = "500";
  let n = buf.readBigUInt64BE(0);
  let suffix = "";
  for (let i = 0; i < 15; i++) {
    suffix += SF_ID_ALPHABET[Number(n % BigInt(SF_ID_ALPHABET.length))]!;
    n /= BigInt(SF_ID_ALPHABET.length);
  }
  return prefix + suffix;
}

function toCaseNumber(buf: Buffer): string {
  const n = (buf.readUInt32BE(8) % 9_000_000) + 1_000_000;
  return String(n);
}

function deterministicCreatedAt(buf: Buffer): Date {
  const ms = Date.UTC(2026, 0, 10) + (buf.readUInt32BE(12) % (45 * 24 * 60 * 60 * 1000));
  return new Date(ms);
}

function mockInstanceBaseUrl(): string {
  return process.env.SALESFORCE_IB_MOCK_INSTANCE_URL?.trim() || "https://demo.sf.example.com";
}

export function createMockSalesforceIbProvider(): SalesforceIbProvider {
  return {
    async createIbCase(payload: SalesforceIbCreatePayload): Promise<SalesforceIbCreateResult> {
      const failFirst = failFirstAttemptPublicCaseIds();
      const simulateFirstFailure =
        failFirst.includes(payload.orchestrationCasePublicId) && !payload.priorFailedAttempt;

      if (simulateFirstFailure) {
        return {
          ok: false,
          errorCode: "MOCK_FORCED_FAILURE",
          errorMessage:
            "Simulated Salesforce error (demo): first attempt fails for this case id; a retry after recording failure succeeds.",
          retryable: true,
          rawResponse: {
            provider: "mock",
            scenario: "fail_first_attempt",
            orchestrationCasePublicId: payload.orchestrationCasePublicId,
          },
        };
      }

      const buf = digestForCase(payload.orchestrationCasePublicId);
      const salesforceRecordId = toSalesforceLikeRecordId(buf);
      const salesforceCaseNumber = toCaseNumber(buf);
      const createdAt = deterministicCreatedAt(buf);
      const recordUrl = `${mockInstanceBaseUrl()}/lightning/r/Case/${salesforceRecordId}/view`;

      return {
        ok: true,
        salesforceRecordId,
        salesforceCaseNumber,
        createdAt,
        recordUrl,
        rawResponse: {
          provider: "mock",
          salesforceRecordId,
          salesforceCaseNumber,
          createdAt: createdAt.toISOString(),
          recordUrl,
        },
      };
    },
  };
}
