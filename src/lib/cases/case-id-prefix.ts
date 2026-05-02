import { RequestType } from "@prisma/client";

/** Public `caseId` type token (before year). `ESS_MSS` → `ESSMSS` (no slash in IDs). */
const REQUEST_TYPE_TO_CASE_ID_TOKEN: Record<RequestType, string> = {
  EoVSS: "EoVSS",
  EoSM: "EoSM",
  ESS_MSS: "ESSMSS",
};

export function publicCaseIdTypeToken(requestType: RequestType): string {
  return REQUEST_TYPE_TO_CASE_ID_TOKEN[requestType];
}
