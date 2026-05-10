import type { SalesforceIbCreatePayload, SalesforceIbCreateResult } from "./types";

export type SalesforceIbProvider = {
  createIbCase(payload: SalesforceIbCreatePayload): Promise<SalesforceIbCreateResult>;
};
