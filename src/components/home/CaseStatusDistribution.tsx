import type { CaseStatus } from "@prisma/client";
import Link from "next/link";
import { formatCaseStatus } from "@/lib/ui/format";
import type { StatusCount } from "@/lib/home/worklists";

type Props = {
  /** Precomputed from visible cases for the signed-in user (same scope as worklists). */
  distribution: StatusCount[];
  /** When true, each row links to the reports dashboard with that case status pre-selected. */
  linkRowsToReports?: boolean;
};

/** Horizontal bar chart — server-rendered; updates on full page refresh. */
export function CaseStatusDistribution({ distribution, linkRowsToReports = false }: Props) {
  const total = distribution.reduce((acc, d) => acc + d.count, 0);
  const max = Math.max(1, ...distribution.map((d) => d.count));

  if (total === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 text-sm text-slate-500">
        No cases in your current view to chart.
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]"
      aria-labelledby="home-status-chart-heading"
    >
      <h3 id="home-status-chart-heading" className="text-sm font-semibold tracking-tight text-slate-900">
        Case status distribution
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Counts reflect cases you can see ({total} total). Refreshes when you reload or sign back in.
        {linkRowsToReports ? " Rows link to Reports with the same status filter." : null}
      </p>
      <div className="mt-4 space-y-2.5">
        {distribution.map(({ status, count }) => (
          <StatusBar
            key={status}
            status={status}
            count={count}
            max={max}
            href={linkRowsToReports ? `/reports?status=${encodeURIComponent(status)}` : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function StatusBar({
  status,
  count,
  max,
  href,
}: {
  status: CaseStatus;
  count: number;
  max: number;
  href?: string;
}) {
  const pct = Math.round((count / max) * 100);
  const width = count === 0 ? 0 : Math.max(4, pct);
  const label = formatCaseStatus(status);

  const inner = (
    <>
      <span className="truncate font-medium text-slate-700" title={label}>
        {label}
      </span>
      <div className="h-2 min-w-0 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-600/85 transition-[width]"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-slate-600">{count}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 rounded-md text-xs text-inherit no-underline outline-offset-2 hover:bg-slate-50/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"
        aria-label={`Open reports filtered by ${label}`}
      >
        {inner}
      </Link>
    );
  }

  return <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-xs">{inner}</div>;
}
