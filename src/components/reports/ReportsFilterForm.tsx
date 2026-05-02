import Link from "next/link";
import { CaseStatus, RequestType } from "@prisma/client";
import type { OwnerFilterOption } from "@/lib/reports/reports-filters";
import type { ReportsFilterState } from "@/lib/reports/reports-filters";
import { filtersAreDefault } from "@/lib/reports/reports-filters";
import { formatCaseStatus, formatRequestType } from "@/lib/ui/format";

const REQUEST_OPTIONS: Array<{ value: "all" | RequestType; label: string }> = [
  { value: "all", label: "All services" },
  { value: RequestType.EoVSS, label: formatRequestType(RequestType.EoVSS) },
  { value: RequestType.EoSM, label: formatRequestType(RequestType.EoSM) },
  { value: RequestType.ESS_MSS, label: formatRequestType(RequestType.ESS_MSS) },
];

const STATUS_OPTIONS: Array<{ value: "all" | CaseStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  ...Object.values(CaseStatus).map((s) => ({ value: s, label: formatCaseStatus(s) })),
];

type Props = {
  applied: ReportsFilterState;
  ownerOptions: OwnerFilterOption[];
  filteredCount: number;
  unfilteredVisibleCount: number;
};

export function ReportsFilterForm({ applied, ownerOptions, filteredCount, unfilteredVisibleCount }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          <p className="mt-1 text-xs text-slate-600">
            GET form — same cohort drives KPIs, segmentation, revenue, cycle time, bottlenecks, aging, and trends.
            Date range uses <span className="font-medium">case created</span> (UTC day bounds).
          </p>
        </div>
        <p className="text-xs font-medium text-slate-700">
          Showing <span className="text-slate-900">{filteredCount}</span> of{" "}
          <span className="text-slate-900">{unfilteredVisibleCount}</span> visible cases
        </p>
      </div>

      <form method="get" action="/reports" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-slate-600">
          Service
          <select
            name="requestType"
            defaultValue={applied.requestType}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
          >
            {REQUEST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-slate-600">
          Case status
          <select
            name="status"
            defaultValue={applied.status}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-slate-600">
          Case owner (routing)
          <select
            name="ownerId"
            defaultValue={applied.ownerId}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
          >
            <option value="all">All owners</option>
            <option value="__unassigned__">Unassigned</option>
            {ownerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-slate-600">
          Created from (UTC)
          <input
            type="date"
            name="dateFrom"
            defaultValue={applied.dateFrom ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-slate-600">
          Created to (UTC)
          <input
            type="date"
            name="dateTo"
            defaultValue={applied.dateTo ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply filters
        </button>
        {!filtersAreDefault(applied) ? (
          <Link
            href="/reports"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Clear all
          </Link>
        ) : null}
      </form>
    </section>
  );
}
