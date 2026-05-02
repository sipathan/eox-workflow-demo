/**
 * Demo financial helpers: USD, two decimal places.
 * Per-platform `totalCost` is always BU + CX (never persisted separately on `CaseAsset`).
 * Case-level rollups sum platform BU/CX and derive total quote value the same way.
 */

/** Round to 2 decimal places (half-up). */
export function roundMoney2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Single platform line: total = BU + CX after per-component rounding. */
export function platformTotalCost(buCost: number, cxCost: number): number {
  return roundMoney2(roundMoney2(buCost) + roundMoney2(cxCost));
}

/** Optional UX helper — not enforced server-side. CX ≈ 43% of BU, rounded to cents. */
export function suggestedCxCostFromBu(buCost: number): number {
  return roundMoney2(roundMoney2(buCost) * 0.43);
}

export type AssetCostInput = { buCost: number; cxCost: number };

export type CaseFinancialRollup = {
  totalBuCost: number;
  totalCxCost: number;
  /** Sum of per-platform (BU+CX) totals; same as combined quote value for the case. */
  totalQuoteValue: number;
};

/** Aggregate stored platform costs for dashboards and case headers. */
export function rollupCaseFinancials(assets: AssetCostInput[]): CaseFinancialRollup {
  let sumBu = 0;
  let sumCx = 0;
  let sumLineTotals = 0;
  for (const a of assets) {
    const bu = roundMoney2(Number(a.buCost) || 0);
    const cx = roundMoney2(Number(a.cxCost) || 0);
    sumBu += bu;
    sumCx += cx;
    sumLineTotals += platformTotalCost(bu, cx);
  }
  return {
    totalBuCost: roundMoney2(sumBu),
    totalCxCost: roundMoney2(sumCx),
    totalQuoteValue: roundMoney2(sumLineTotals),
  };
}

/** Coerce Prisma / form numbers into non-negative finite values for persistence. */
export function normalizeMoneyInput(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return roundMoney2(Math.min(x, 999_999_999.99));
}

/**
 * Sum of optional per-line `quantity` values where set (non-null, finite, ≥ 0).
 * Returns `null` when no line has a quantity — callers should show "—" or omit.
 */
export function totalQuantityFromAssets(assets: ReadonlyArray<{ quantity: number | null }>): number | null {
  let sum = 0;
  let any = false;
  for (const a of assets) {
    const q = a.quantity;
    if (q == null) continue;
    const n = typeof q === "number" ? q : Number(q);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) continue;
    sum += n;
    any = true;
  }
  return any ? sum : null;
}
