"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { platformTotalCost, suggestedCxCostFromBu } from "@/lib/cases/financials";
import { formatUsd2 } from "@/lib/ui/format";
import type { CaseFormValues } from "@/lib/validations/case";

type Props = {
  control: Control<CaseFormValues>;
  register: UseFormRegister<CaseFormValues>;
  index: number;
  buError?: string;
  cxError?: string;
  setCxValue: (cx: number) => void;
};

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Per-platform BU/CX inputs with live total (intake). */
export function IntakeAssetFinancialFields({
  control,
  register,
  index,
  buError,
  cxError,
  setCxValue,
}: Props) {
  const buRaw = useWatch({ control, name: `assets.${index}.buCost`, defaultValue: 0 });
  const cxRaw = useWatch({ control, name: `assets.${index}.cxCost`, defaultValue: 0 });
  const bu = toNum(buRaw);
  const cx = toNum(cxRaw);
  const lineTotal = platformTotalCost(bu, cx);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4 ring-1 ring-slate-900/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Platform financials (USD)</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Total updates as you type. CX suggestion is optional — use the link below to fill 43% of BU.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Line total</p>
          <p className="text-sm font-semibold tabular-nums text-slate-900">{formatUsd2(lineTotal)}</p>
          <p className="text-[10px] text-slate-400">BU + CX</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">BU cost</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums shadow-sm"
            {...register(`assets.${index}.buCost`, { valueAsNumber: true })}
          />
          {buError ? <p className="mt-1 text-xs text-rose-700">{buError}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">CX cost</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums shadow-sm"
            {...register(`assets.${index}.cxCost`, { valueAsNumber: true })}
          />
          {cxError ? <p className="mt-1 text-xs text-rose-700">{cxError}</p> : null}
        </div>
      </div>
      <button
        type="button"
        className="mt-2 text-xs font-medium text-sky-800 underline decoration-sky-300/70 hover:text-sky-950"
        onClick={() => setCxValue(suggestedCxCostFromBu(bu))}
      >
        Apply 43% of BU as CX (suggestion only)
      </button>
    </div>
  );
}
