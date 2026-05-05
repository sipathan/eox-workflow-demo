import { TaskStatus } from "@prisma/client";
import type { CaseListRow } from "@/lib/cases/queries";
import { userHasOperationalTaskTie } from "@/lib/tasks/direct-assignees";

/** Primary platform name plus overflow count for multi-platform cases. */
export function caseListPlatformSummary(row: CaseListRow): string {
  const total = row._count.assets;
  if (total === 0) return "—";
  const primary = row.assets[0]?.platformName?.trim();
  if (total === 1) return primary || "—";
  return `${primary || "Platforms"} +${total - 1}`;
}

export function caseListDealIdDisplay(dealId: string | null | undefined): string {
  const t = dealId?.trim();
  return t ? t : "—";
}

/** Short hint for queue/home: runnable open work vs queued (not yet runnable) tasks. */
export function caseListTaskWorkHint(row: CaseListRow): string {
  const openRunnable = row.tasks.filter(
    (t) =>
      t.isRunnable &&
      t.status !== TaskStatus.Completed &&
      t.status !== TaskStatus.NotRequired
  ).length;
  const notYetRunnable = row.tasks.filter((t) => !t.isRunnable).length;
  if (openRunnable === 0 && notYetRunnable === 0) return "No tasks";
  if (openRunnable === 0) return `${notYetRunnable} queued`;
  if (notYetRunnable === 0) return `${openRunnable} active`;
  return `${openRunnable} active · ${notYetRunnable} queued`;
}

/**
 * Same as `caseListTaskWorkHint`, plus how many **open runnable** tasks this user can act on
 * (direct assignee or task team). Null-safe on `assignees`.
 */
export function caseListTaskWorkHintForUser(
  row: CaseListRow,
  userId: string,
  userTeamIds: Set<string>
): string {
  const base = caseListTaskWorkHint(row);
  const yours = row.tasks.filter(
    (t) =>
      t.isRunnable &&
      t.status !== TaskStatus.Completed &&
      t.status !== TaskStatus.NotRequired &&
      userHasOperationalTaskTie(userId, userTeamIds, t)
  ).length;
  if (yours === 0) return base;
  return `${base} · ${yours} open involve you`;
}
