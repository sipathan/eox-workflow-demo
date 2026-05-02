import { CaseStatus, RoleKey, TaskStatus, TaskType } from "@prisma/client";
import {
  canUpdateTask,
  hasAnyRole,
  isPlatformAdmin,
  isReadOnlyDemoUser,
  type CaseAccessRow,
  type TaskAccessRow,
} from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth/session";
import type { CaseListRow } from "@/lib/cases/queries";

const TERMINAL: ReadonlySet<CaseStatus> = new Set([
  CaseStatus.Closed,
  CaseStatus.Rejected,
  CaseStatus.Cancelled,
]);

/** Pipeline / in-flight (excludes terminal; includes Draft). */
function isNonTerminalStatus(status: CaseStatus): boolean {
  return !TERMINAL.has(status);
}

function toCaseAccessRow(r: CaseListRow): CaseAccessRow {
  return {
    requesterId: r.requesterId,
    ownerId: r.ownerId,
    assignedTeamId: r.assignedTeamId,
    taskOwnerIds: r.tasks.map((t) => t.ownerId).filter(Boolean) as string[],
    taskTeamIds: r.tasks.map((t) => t.assignedTeamId).filter(Boolean) as string[],
  };
}

function toTaskAccessRow(t: CaseListRow["tasks"][number]): TaskAccessRow {
  return {
    ownerId: t.ownerId,
    assignedTeamId: t.assignedTeamId,
    type: t.type,
    isRunnable: t.isRunnable,
  };
}

/**
 * User has a direct stake in the case (same spirit as `myWorkCases`, plus CX/Admin/Leadership portfolio).
 * Rows are already limited to `canViewCase`.
 */
export function isWorklistInvolvement(user: SessionUser, r: CaseListRow): boolean {
  if (isPlatformAdmin(user) || hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.LEADERSHIP_READONLY])) {
    return true;
  }
  if (r.ownerId === user.id) return true;
  if (r.requesterId === user.id) return true;
  const teamIds = new Set(user.teams.map((t) => t.id));
  if (r.assignedTeamId && teamIds.has(r.assignedTeamId)) return true;
  return r.tasks.some(
    (t) => t.ownerId === user.id || (!!t.assignedTeamId && teamIds.has(t.assignedTeamId))
  );
}

/** Cases the user tracks as “active” work — non-terminal, involvement-aware. */
export function filterMyActiveCases(user: SessionUser, rows: CaseListRow[]): CaseListRow[] {
  return rows.filter((r) => {
    if (!isNonTerminalStatus(r.status)) return false;
    return isWorklistInvolvement(user, r);
  });
}

/** Runnable tasks the user may update (empty for read-only leadership-only). */
export function filterCasesAwaitingMyInput(user: SessionUser, rows: CaseListRow[]): CaseListRow[] {
  if (isReadOnlyDemoUser(user)) return [];
  const access = (r: CaseListRow) => toCaseAccessRow(r);
  return rows.filter((r) => {
    return r.tasks.some((t) => {
      if (!t.isRunnable) return false;
      if (t.status === TaskStatus.Completed || t.status === TaskStatus.NotRequired) return false;
      return canUpdateTask(user, toTaskAccessRow(t), access(r));
    });
  });
}

function userRelevantToInfoReturn(user: SessionUser, r: CaseListRow, t: CaseListRow["tasks"][number]): boolean {
  const row = toCaseAccessRow(r);
  if (hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN])) return true;
  if (hasAnyRole(user, [RoleKey.LEADERSHIP_READONLY])) return true;
  if (r.requesterId === user.id && hasAnyRole(user, [RoleKey.ACCOUNT_TEAM])) return true;
  return canUpdateTask(user, toTaskAccessRow(t), row);
}

/** Awaiting Info at case level, or an active Additional Info task relevant to the user. */
export function filterCasesReturnedForMoreInformation(user: SessionUser, rows: CaseListRow[]): CaseListRow[] {
  return rows.filter((r) => {
    if (r.status === CaseStatus.AwaitingInfo) return isWorklistInvolvement(user, r);
    return r.tasks.some(
      (t) =>
        t.type === TaskType.AdditionalInfoRequest &&
        t.isRunnable &&
        t.status !== TaskStatus.Completed &&
        t.status !== TaskStatus.NotRequired &&
        userRelevantToInfoReturn(user, r, t)
    );
  });
}

/** Dedupe by case id while preserving first occurrence order. */
export function dedupeCasesById(rows: CaseListRow[]): CaseListRow[] {
  const seen = new Set<string>();
  const out: CaseListRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export type StatusCount = { status: CaseStatus; count: number };

/** Count visible cases by status for the home chart (uses the same row set as worklists). */
export function caseStatusDistribution(rows: CaseListRow[]): StatusCount[] {
  const order: CaseStatus[] = [
    CaseStatus.Draft,
    CaseStatus.Submitted,
    CaseStatus.InReview,
    CaseStatus.AwaitingInfo,
    CaseStatus.InProgress,
    CaseStatus.Blocked,
    CaseStatus.ReadyForRelease,
    CaseStatus.Closed,
    CaseStatus.Rejected,
    CaseStatus.Cancelled,
  ];
  const counts = new Map<CaseStatus, number>();
  for (const s of order) counts.set(s, 0);
  for (const r of rows) {
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  }
  return order.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}
