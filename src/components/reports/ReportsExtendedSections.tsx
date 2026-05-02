import type { ReactNode } from "react";
import type {
  CaseStatusAgingRow,
  ReportsBottleneckModel,
  TaskAgingRow,
  TimeSeriesMonthRow,
} from "@/lib/reports/dashboard-metrics";
import { formatCaseStatus, formatTaskType, formatUsd2 } from "@/lib/ui/format";

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-slate-900">{children}</h2>;
}

function SubTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

function LabeledBars({
  title,
  subtitle,
  rows,
  valueSuffix = "",
}: {
  title: string;
  subtitle?: string;
  rows: { key: string; label: string; value: number }[];
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No data in this cohort.</p>
        ) : (
          rows.map((r) => (
            <div key={r.key}>
              <div className="flex justify-between gap-2 text-xs text-slate-700">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {r.value}
                  {valueSuffix}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-sky-700 transition-[width]"
                  style={{ width: `${Math.round((r.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusHeatStrip({ rows }: { rows: CaseStatusAgingRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.caseCount));
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((r) => {
        const intensity = 0.12 + (r.caseCount / max) * 0.55;
        return (
          <div
            key={r.status}
            title={`${formatCaseStatus(r.status)}: ${r.caseCount} cases`}
            className="min-w-[100px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-center"
            style={{ backgroundColor: `rgba(15, 23, 42, ${intensity})` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/95">
              {formatCaseStatus(r.status)}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{r.caseCount}</p>
            <p className="mt-0.5 text-[10px] text-white/85">
              avg {r.averageDays != null ? `${r.averageDays.toFixed(1)} d` : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

type BottleneckProps = {
  model: ReportsBottleneckModel;
};

export function ReportsBottleneckSection({ model }: BottleneckProps) {
  const statusRows = model.casesByStatus.map((x) => ({
    key: x.status,
    label: formatCaseStatus(x.status),
    value: x.count,
  }));

  const signalRows = [
    { key: "blocked", label: "Case status = Blocked", value: model.blockedCaseCount },
    {
      key: "bu",
      label: "Awaiting BU / eligibility (runnable BU or eligibility review tasks)",
      value: model.awaitingBuCaseCount,
    },
    { key: "vap", label: "Awaiting VAP (runnable open VAP task)", value: model.awaitingVapCaseCount },
    { key: "flag", label: "Awaiting flag removal", value: model.awaitingFlagRemovalCaseCount },
  ];

  return (
    <section className="space-y-4">
      <SectionTitle>Bottleneck identification</SectionTitle>
      <SubTitle>
        “Awaiting” counts distinct cases with at least one matching <strong>runnable</strong> task that is not{" "}
        <strong>Completed</strong> or <strong>Not required</strong>. Blocked uses <strong>case</strong> status only.
      </SubTitle>

      {model.topBottleneck ? (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold text-amber-900">Top signal: </span>
          {model.topBottleneck.label} ({model.topBottleneck.count})
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <LabeledBars title="Cases by current case status" rows={statusRows} />
        <LabeledBars title="Workflow queue signals (case counts)" rows={signalRows} />
      </div>

      {model.casesByStatus[0] ? (
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">Busiest case status: </span>
          {formatCaseStatus(model.casesByStatus[0].status)} ({model.casesByStatus[0].count} cases).
        </p>
      ) : null}
    </section>
  );
}

type AgingProps = {
  caseRows: CaseStatusAgingRow[];
  taskRows: TaskAgingRow[];
  caseAssumption: string;
  taskAssumption: string;
};

export function ReportsAgingSection({ caseRows, taskRows, caseAssumption, taskAssumption }: AgingProps) {
  return (
    <section className="space-y-4">
      <SectionTitle>Aging by status &amp; open tasks</SectionTitle>
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
        <p>
          <strong>Case status strip:</strong> {caseAssumption}
        </p>
        <p className="mt-2">
          <strong>Task aging table:</strong> {taskAssumption}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Case status cohort (heatmap)</p>
        {caseRows.length === 0 ? (
          <p className="text-sm text-slate-500">No cases in cohort.</p>
        ) : (
          <StatusHeatStrip rows={caseRows} />
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Case status</th>
              <th className="px-3 py-2">Cases</th>
              <th className="px-3 py-2">Avg days (see note)</th>
            </tr>
          </thead>
          <tbody>
            {caseRows.map((r) => (
              <tr key={r.status} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{formatCaseStatus(r.status)}</td>
                <td className="px-3 py-2 tabular-nums">{r.caseCount}</td>
                <td className="px-3 py-2 tabular-nums">{r.averageDays != null ? r.averageDays.toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Open runnable task aging (by task type)
        </p>
        {taskRows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">No open runnable tasks in this cohort.</p>
        ) : (
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Task type</th>
                <th className="px-3 py-2">Open runnable tasks</th>
                <th className="px-3 py-2">Avg age (days)</th>
              </tr>
            </thead>
            <tbody>
              {taskRows.map((r) => (
                <tr key={r.taskType} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{formatTaskType(r.taskType)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.openRunnableTaskCount}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.averageAgeDays != null ? r.averageAgeDays.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function MonthSparkBars({
  title,
  subtitle,
  months,
  getValue,
  formatValue,
}: {
  title: string;
  subtitle: string;
  months: TimeSeriesMonthRow[];
  getValue: (m: TimeSeriesMonthRow) => number;
  formatValue: (n: number) => string;
}) {
  const max = Math.max(1, ...months.map((m) => getValue(m)));
  const barMaxPx = 112;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-3 flex h-36 items-end gap-1.5 overflow-x-auto pb-1">
        {months.length === 0 ? (
          <p className="text-sm text-slate-500">No months in cohort.</p>
        ) : (
          months.map((m) => {
            const v = getValue(m);
            const px = v <= 0 ? 2 : Math.max(4, (v / max) * barMaxPx);
            return (
              <div key={m.monthKey + title} className="flex w-8 shrink-0 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t bg-indigo-600"
                  style={{ height: `${px}px` }}
                  title={`${m.monthKey}: ${formatValue(v)}`}
                />
                <span className="whitespace-nowrap font-mono text-[9px] leading-none text-slate-500">
                  {m.monthKey}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

type TrendsProps = {
  series: TimeSeriesMonthRow[];
};

export function ReportsTrendsSection({ series }: TrendsProps) {
  return (
    <section className="space-y-4">
      <SectionTitle>Trends (UTC months)</SectionTitle>
      <SubTitle>
        Created and revenue use the case <strong>created</strong> month. Closed uses <strong>updatedAt</strong> month
        for cases in <strong>Closed</strong> status (same close proxy as cycle metrics).
      </SubTitle>
      {series.length === 0 ? (
        <p className="text-sm text-slate-500">No time-series points for this cohort.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <MonthSparkBars
            title="Cases created"
            subtitle="Count by month of Case.createdAt"
            months={series}
            getValue={(m) => m.casesCreated}
            formatValue={(n) => String(n)}
          />
          <MonthSparkBars
            title="Revenue (quote value)"
            subtitle="Sum of case rollups by created month"
            months={series}
            getValue={(m) => m.revenueQuoteValue}
            formatValue={(n) => formatUsd2(n)}
          />
          <MonthSparkBars
            title="Cases closed"
            subtitle="Count by month of Case.updatedAt (Closed only)"
            months={series}
            getValue={(m) => m.casesClosed}
            formatValue={(n) => String(n)}
          />
        </div>
      )}
    </section>
  );
}
