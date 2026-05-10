export type SalesforceIbProviderKind = "mock" | "salesforce";

/**
 * `SALESFORCE_IB_PROVIDER`: `mock` (default) or `salesforce` (REST scaffold; requires future implementation + env).
 */
export function getSalesforceIbProviderKind(): SalesforceIbProviderKind {
  const v = process.env.SALESFORCE_IB_PROVIDER?.trim().toLowerCase();
  if (v === "salesforce") return "salesforce";
  return "mock";
}
