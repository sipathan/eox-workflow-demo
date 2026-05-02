import { TaskType } from "@prisma/client";
import { formatTaskType } from "@/lib/ui/format";

const TASK_FLOW_ORDER: TaskType[] = [
  TaskType.IntakeValidation,
  TaskType.EligibilityReview,
  TaskType.BUReview,
  TaskType.BUPricing,
  TaskType.QuoteTracking,
  TaskType.VAPTracking,
  TaskType.FlagRemovalTracking,
  TaskType.AdditionalInfoRequest,
];

function typeOrder(t: TaskType): number {
  const i = TASK_FLOW_ORDER.indexOf(t);
  return i === -1 ? 99 : i;
}

/** Stable order for case detail: workflow sequence, then per-asset rows by asset sortOrder. */
export function sortCaseTasksForDisplay<
  T extends { id: string; type: TaskType; caseAsset: { sortOrder: number } | null },
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const oa = typeOrder(a.type);
    const ob = typeOrder(b.type);
    if (oa !== ob) return oa - ob;
    const sa = a.caseAsset?.sortOrder ?? -1;
    const sb = b.caseAsset?.sortOrder ?? -1;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });
}

/** Task type plus platform when the task is tied to a CaseAsset (e.g. BU Review), or eligibility scope from notes. */
export function taskWorkItemLabel(t: {
  type: TaskType;
  caseAsset: { platformName: string } | null;
  notes?: string | null;
}): string {
  const base = formatTaskType(t.type);
  if (t.caseAsset) return `${base} · ${t.caseAsset.platformName}`;
  if (t.type === TaskType.EligibilityReview && t.notes?.trim()) {
    const line = t.notes.trim().split(/\r?\n/)[0] ?? t.notes.trim();
    const short = line.length > 72 ? `${line.slice(0, 69)}…` : line;
    return `${base} · ${short}`;
  }
  return base;
}

/** Days since the task became runnable; inactive tasks are not counted. */
export function daysActiveDisplay(activatedAt: Date | null, isRunnable: boolean): string {
  if (!isRunnable) return "Not active";
  if (!activatedAt) return "—";
  const days = Math.floor((Date.now() - activatedAt.getTime()) / 86_400_000);
  return String(Math.max(0, days));
}
