"use client";

import { useState } from "react";
import { updateCaseAssetCostsAction } from "@/app/actions/case-workspace";
import { platformTotalCost, suggestedCxCostFromBu } from "@/lib/cases/financials";
import { formatUsd2 } from "@/lib/ui/format";

type Props = {
  caseId: string;
  assetId: string;
  platformLabel: string;
  initialBuCost: number;
  initialCxCost: number;
  canEdit: boolean;
};

function parseMoney(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Per-platform cost display/edit with live line total. */
export function PlatformAssetCostEditor({
  caseId,
  assetId,
  platformLabel,
  initialBuCost,
  initialCxCost,
  canEdit,
}: Props) {
  const [bu, setBu] = useState(String(initialBuCost));
  const [cx, setCx] = useState(String(initialCxCost));

  const buN = parseMoney(bu);
  const cxN = parseMoney(cx);
  const lineTotal = platformTotalCost(buN, cxN);

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold text-slate-800">{platformLabel}</p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-slate-500">BU</dt>
            <dd className="font-medium tabular-nums text-slate-900">{formatUsd2(initialBuCost)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">CX</dt>
            <dd className="font-medium tabular-nums text-slate-900">{formatUsd2(initialCxCost)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{formatUsd2(platformTotalCost(initialBuCost, initialCxCost))}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]">
      <p className="text-xs font-semibold text-slate-800">{platformLabel}</p>
      <form action={updateCaseAssetCostsAction} className="mt-3 space-y-3">
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="assetId" value={assetId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-600">
            BU cost (USD)
            <input
              name="buCost"
              type="number"
              min={0}
              step="0.01"
              value={bu}
              onChange={(e) => setBu(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums shadow-sm"
            />
          </label>
          <label className="block text-xs text-slate-600">
            CX cost (USD)
            <input
              name="cxCost"
              type="number"
              min={0}
              step="0.01"
              value={cx}
              onChange={(e) => setCx(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums shadow-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Line total</p>
            <p className="text-base font-semibold tabular-nums text-slate-900">{formatUsd2(lineTotal)}</p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-sky-800 underline decoration-sky-300/70 hover:text-sky-950"
            onClick={() => setCx(String(suggestedCxCostFromBu(buN)))}
          >
            Suggest CX as 43% of BU
          </button>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Save costs
          </button>
        </div>
      </form>
    </div>
  );
}
