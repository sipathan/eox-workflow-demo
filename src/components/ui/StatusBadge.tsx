import type { CaseStatus } from "@prisma/client";
import { formatCaseStatus } from "@/lib/ui/format";

const TONE: Partial<Record<CaseStatus, string>> = {
  Draft: "bg-slate-100 text-slate-800 ring-slate-200",
  Submitted: "bg-sky-50 text-sky-900 ring-sky-200",
  InReview: "bg-indigo-50 text-indigo-900 ring-indigo-200",
  AwaitingInfo: "bg-amber-50 text-amber-900 ring-amber-200",
  InProgress: "bg-blue-50 text-blue-900 ring-blue-200",
  Blocked: "bg-rose-50 text-rose-900 ring-rose-200",
  ReadyForRelease: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  Closed: "bg-slate-100 text-slate-600 ring-slate-200",
  Rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  Cancelled: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const ring = TONE[status] ?? "bg-slate-100 text-slate-800 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ring}`}>
      {formatCaseStatus(status)}
    </span>
  );
}
