import { formatUsd2 } from "@/lib/ui/format";

/** Standalone case-level rollup card. Case detail (`/cases/[id]`) inlines the same figures in **Case summary**; this export remains for reuse (e.g. future dashboards). */

type Props = {
  assetCount: number;
  totalBuCost: number;
  totalCxCost: number;
  totalQuoteValue: number;
};

/** Case-level rollup — sums stored platform lines (see `rollupCaseFinancials`). */
export function CaseFinancialSummary({ assetCount, totalBuCost, totalCxCost, totalQuoteValue }: Props) {
  if (assetCount === 0) return null;

  const scope =
    assetCount > 1
      ? `Figures below are the sum across all ${assetCount} platform lines on this case.`
      : "Single platform line on this case.";

  return (
    <section
      className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white p-5 shadow-sm ring-1 ring-emerald-900/[0.04]"
      aria-labelledby="case-financial-summary-heading"
    >
      <h2 id="case-financial-summary-heading" className="text-sm font-semibold text-slate-900">
        Case financial summary
      </h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">{scope}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total BU cost</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatUsd2(totalBuCost)}</dd>
        </div>
        <div className="rounded-lg border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total CX cost</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatUsd2(totalCxCost)}</dd>
        </div>
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-100/40 px-4 py-3 shadow-sm sm:col-span-1">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-900/80">Total quote value</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-emerald-950">{formatUsd2(totalQuoteValue)}</dd>
          <p className="mt-1 text-[10px] text-emerald-900/70">
            Sum of each platform line total (BU + CX, rounded per line then added) — same as platform cards below.
          </p>
        </div>
      </dl>
    </section>
  );
}
