import { TaskStatus } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import type { CaseListRow } from "@/lib/cases/queries";
import {
  dedupeCasesById,
  filterCasesAwaitingMyInput,
  isNonTerminalCaseStatus,
} from "@/lib/home/worklists";

/** Open operational task work: runnable and not finished / waived (matches Home “awaiting input” task gate). */
export function caseHasOpenRunnableIncompleteTask(row: CaseListRow): boolean {
  return row.tasks.some(
    (t) =>
      t.isRunnable && t.status !== TaskStatus.Completed && t.status !== TaskStatus.NotRequired
  );
}

export type HomeKpiCounts = {
  visibleCases: number;
  activeCases: number;
  pendingYourInput: number;
  pendingInputFromOthers: number;
};

/**
 * Home summary KPIs over `listCasesVisibleToUser` rows only.
 * — **Active**: non-terminal case statuses (`Closed` / `Rejected` / `Cancelled` excluded; includes `Draft`).
 * — **Pending your input**: same task/case rules as `filterCasesAwaitingMyInput`, restricted to active cases.
 * — **Pending from others**: active cases with open runnable incomplete tasks, excluding those awaiting the user.
 */
export function buildHomeKpiCounts(user: SessionUser, visibleCases: CaseListRow[]): HomeKpiCounts {
  const visibleCasesCount = visibleCases.length;
  const activeRows = visibleCases.filter((r) => isNonTerminalCaseStatus(r.status));
  const activeCases = activeRows.length;

  const awaitingMine = dedupeCasesById(filterCasesAwaitingMyInput(user, activeRows));
  const pendingYourInput = awaitingMine.length;
  const awaitingIds = new Set(awaitingMine.map((r) => r.id));

  const pendingInputFromOthers = activeRows.filter(
    (r) => caseHasOpenRunnableIncompleteTask(r) && !awaitingIds.has(r.id)
  ).length;

  return {
    visibleCases: visibleCasesCount,
    activeCases,
    pendingYourInput,
    pendingInputFromOthers,
  };
}
