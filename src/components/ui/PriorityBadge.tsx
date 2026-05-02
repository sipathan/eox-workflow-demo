import type { Priority } from "@prisma/client";

const TONE: Record<Priority, string> = {
  Low: "bg-slate-50 text-slate-700 ring-slate-200",
  Medium: "bg-amber-50 text-amber-900 ring-amber-200",
  High: "bg-orange-50 text-orange-900 ring-orange-200",
  Critical: "bg-rose-50 text-rose-900 ring-rose-200",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[priority]}`}
    >
      {priority}
    </span>
  );
}
