import type { ReactNode } from "react";
import type { ReportsPageData } from "@/lib/reports/dashboard-metrics";
import { formatRequestType, formatUsd2 } from "@/lib/ui/format";
import { ReportsFilterForm } from "@/components/reports/ReportsFilterForm";
import {
  ReportsAgingSection,
  ReportsBottleneckSection,
  ReportsTrendsSection,
} from "@/components/reports/ReportsExtendedSections";

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function daysLabel(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)} days`;
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-slate-100 px-3 py-2 text-sm text-slate-800 ${className ?? ""}`}>{children}</td>;
}

type Props = {
  data: ReportsPageData;
};

export function ReportsDashboardView({ data }: Props) {
  const {
    dashboard: model,
    bottlenecks,
    caseStatusAging,
    taskAging,
    timeSeries,
    caseStatusAgingAssumption,
    taskAgingAssumption,
    dateFilterAssumption,
  } = data;
  const { executive, overallFinancial, byService, monthlyClosed, lostOpportunity, cycleTimeAssumption } = model;

  return (
    <div className="space-y-10">
      <ReportsFilterForm
        applied={data.appliedFilters}
        ownerOptions={data.ownerOptions}
        filteredCount={data.filteredCount}
        unfilteredVisibleCount={data.unfilteredVisibleCount}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Executive summary</h2>
        <p className="text-xs text-slate-500">
          All figures below use the <strong>filtered cohort</strong> (same set for every section).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total cases" value={String(executive.totalCases)} />
          <KpiCard label="Active cases" value={String(executive.activeCases)} hint="Non-terminal statuses (includes Draft)." />
          <KpiCard label="Closed cases" value={String(executive.closedCases)} hint="Status = Closed only." />
          <KpiCard
            label="Average cycle time"
            value={daysLabel(executive.averageCycleDays)}
            hint="Closed cases only; see methodology note below."
          />
          <KpiCard
            label="Total quote value"
            value={formatUsd2(executive.totalQuoteValue)}
            hint="Sum of per-case rollups (each line = BU + CX on CaseAsset)."
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-amber-50/60 p-4 text-sm text-amber-950">
        <p className="font-medium text-amber-900">Methodology</p>
        <p className="mt-1 leading-relaxed text-amber-950/90">{dateFilterAssumption}</p>
        <p className="mt-2 leading-relaxed text-amber-950/90">{cycleTimeAssumption}</p>
        <p className="mt-2 leading-relaxed text-amber-950/90">
          <strong>Average quote value</strong> (overall and per service — EoVSS, EoSM, ESS/MSS) is total quote value ÷
          case count in that scope, including cases with zero asset costs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Revenue &amp; cost (overall)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <Th>Total quote value</Th>
                <Th>Total BU cost</Th>
                <Th>Total CX cost</Th>
                <Th>Average quote value</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>{formatUsd2(overallFinancial.totalQuoteValue)}</Td>
                <Td>{formatUsd2(overallFinancial.totalBuCost)}</Td>
                <Td>{formatUsd2(overallFinancial.totalCxCost)}</Td>
                <Td>{formatUsd2(overallFinancial.averageQuoteValue)}</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Service segmentation</h2>
        <p className="text-xs text-slate-500">
          <strong>EoVSS</strong>, <strong>EoSM</strong> (End of Software Maintenance), and <strong>ESS/MSS</strong> use
          the same metrics as the executive view, scoped to each service. The sum of <strong>Total quote</strong> (and of
          BU / CX) across the three rows matches the overall revenue row — each case belongs to exactly one of these
          services.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Cases</Th>
                <Th>Active</Th>
                <Th>Closed</Th>
                <Th>Total quote</Th>
                <Th>Total BU</Th>
                <Th>Total CX</Th>
                <Th>Avg quote</Th>
                <Th>Avg cycle (closed)</Th>
              </tr>
            </thead>
            <tbody>
              {byService.map((s) => (
                <tr key={s.requestType} className="hover:bg-slate-50/80">
                  <Td className="font-medium text-slate-900">{formatRequestType(s.requestType)}</Td>
                  <Td>{s.caseCount}</Td>
                  <Td>{s.activeCases}</Td>
                  <Td>{s.closedCases}</Td>
                  <Td>{formatUsd2(s.totalQuoteValue)}</Td>
                  <Td>{formatUsd2(s.totalBuCost)}</Td>
                  <Td>{formatUsd2(s.totalCxCost)}</Td>
                  <Td>{formatUsd2(s.averageQuoteValue)}</Td>
                  <Td>{daysLabel(s.averageCycleDaysClosed)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReportsBottleneckSection model={bottlenecks} />

      <ReportsAgingSection
        caseRows={caseStatusAging}
        taskRows={taskAging}
        caseAssumption={caseStatusAgingAssumption}
        taskAssumption={taskAgingAssumption}
      />

      <ReportsTrendsSection series={timeSeries} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Throughput &amp; cycle time trend</h2>
        <p className="text-xs text-slate-500">
          Cases closed per calendar month (UTC) and average cycle length for cases closed in that month.
        </p>
        {monthlyClosed.length === 0 ? (
          <p className="text-sm text-slate-500">No closed cases in your current scope.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Month (UTC)</Th>
                  <Th>Cases closed</Th>
                  <Th>Avg cycle (days)</Th>
                </tr>
              </thead>
              <tbody>
                {monthlyClosed.map((m) => (
                  <tr key={m.monthKey} className="hover:bg-slate-50/80">
                    <Td className="font-mono text-xs">{m.monthKey}</Td>
                    <Td>{m.closedCount}</Td>
                    <Td>{daysLabel(m.averageCycleDays)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Lost opportunity</h2>
        <p className="text-xs text-slate-500">
          Commercial outcomes where the case was marked <strong>Not booked</strong> or <strong>Passed over</strong>,
          grouped by stored reason (demo).
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Not booked" value={String(lostOpportunity.notBookedCount)} />
          <KpiCard label="Passed over" value={String(lostOpportunity.passedOverCount)} />
          <KpiCard label="Total lost pipeline" value={String(lostOpportunity.totalLostCount)} />
        </div>
        {lostOpportunity.byReason.length === 0 ? (
          <p className="text-sm text-slate-500">No lost-opportunity cases in scope.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Reason (not booked / passed over)</Th>
                  <Th>Cases</Th>
                </tr>
              </thead>
              <tbody>
                {lostOpportunity.byReason.map((r) => (
                  <tr key={r.reasonLabel} className="hover:bg-slate-50/80">
                    <Td className="max-w-md">{r.reasonLabel}</Td>
                    <Td>{r.count}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
