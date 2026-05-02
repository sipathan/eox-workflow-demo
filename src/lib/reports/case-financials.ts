/**
 * Financial reporting helpers over normalized `Case` + `CaseAsset` data.
 *
 * - Per-case totals: use `rollupCaseFinancials` on loaded assets (same as case workspace).
 * - Cross-case rollups in-app: `getReportsPageData` / `buildReportsDashboard` in
 *   `src/lib/reports/dashboard-metrics.ts` (same `rollupCaseFinancials` semantics, scoped by `canViewCase` + optional URL filters).
 * - Lost opportunity: filter `Case.quoteBookingStatus IN (NOT_BOOKED, PASSED_OVER)` and
 *   group by `notBookedReason` (trimmed) for funnel reporting.
 */
export {
  platformTotalCost,
  rollupCaseFinancials,
  roundMoney2,
  totalQuantityFromAssets,
  type CaseFinancialRollup,
} from "@/lib/cases/financials";
