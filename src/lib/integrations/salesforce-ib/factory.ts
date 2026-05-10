import { getSalesforceIbProviderKind } from "./env";
import { createMockSalesforceIbProvider } from "./mock-provider";
import { createSalesforceRestProvider } from "./salesforce-rest-provider";
import type { SalesforceIbProvider } from "./provider";

/** Resolves the active Salesforce IB provider from `SALESFORCE_IB_PROVIDER`. */
export function getSalesforceIbProvider(): SalesforceIbProvider {
  const kind = getSalesforceIbProviderKind();
  if (kind === "salesforce") return createSalesforceRestProvider();
  return createMockSalesforceIbProvider();
}
