import type { Case, Task } from "@prisma/client";
import { CaseStatus, RoleKey, TaskType } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

/** True if the user carries any of the given roles. */
export function hasAnyRole(user: SessionUser, roles: readonly RoleKey[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}

export function isPlatformAdmin(user: SessionUser): boolean {
  return user.roles.includes(RoleKey.PLATFORM_ADMIN);
}

export function isLeadershipReadonly(user: SessionUser): boolean {
  return user.roles.includes(RoleKey.LEADERSHIP_READONLY);
}

/** Minimal case + assignment projection for authorization (no full Prisma graph required). */
export type CaseAccessRow = Pick<Case, "requesterId" | "ownerId" | "assignedTeamId"> & {
  taskOwnerIds: string[];
  taskTeamIds: string[];
};

export type CaseUpdateRow = CaseAccessRow & Pick<Case, "status">;

export type TaskAccessRow = Pick<Task, "ownerId" | "assignedTeamId" | "type">;

function userTeamIds(user: SessionUser): Set<string> {
  return new Set(user.teams.map((t) => t.id));
}

/**
 * Team queue behavior: an unowned task can still be actioned by users on the assigned team
 * when their role permits task updates.
 */
export function canActOnUnownedTeamTask(user: SessionUser, task: TaskAccessRow): boolean {
  if (task.ownerId) return false;
  if (!task.assignedTeamId) return false;
  const onTeam = userTeamIds(user).has(task.assignedTeamId);
  if (!onTeam) return false;
  if (isReadOnlyDemoUser(user)) return false;
  return hasAnyRole(user, [
    RoleKey.CX_OPS,
    RoleKey.PLATFORM_ADMIN,
    RoleKey.BU_CONTRIBUTOR,
    RoleKey.FINANCE_APPROVER,
  ]);
}

/**
 * Whether the user may see a case in list/detail views.
 * — Account team: own requests only.
 * — CX Ops: all in-scope cases for demo.
 * — BU / Finance: assigned owner or team on a task, case owner, or team-aligned case queue.
 * — Leadership: read-only portfolio visibility.
 * — Platform admin: full visibility.
 */
export function canViewCase(user: SessionUser, row: CaseAccessRow): boolean {
  if (isPlatformAdmin(user)) return true;
  if (hasAnyRole(user, [RoleKey.CX_OPS])) return true;

  if (hasAnyRole(user, [RoleKey.ACCOUNT_TEAM])) {
    return row.requesterId === user.id;
  }

  const teamIds = userTeamIds(user);
  const onCaseTeam = !!row.assignedTeamId && teamIds.has(row.assignedTeamId);
  const onTaskTeam = row.taskTeamIds.some((id) => teamIds.has(id));
  const ownsTask = row.taskOwnerIds.includes(user.id);
  const isCaseOwner = row.ownerId === user.id;

  if (hasAnyRole(user, [RoleKey.BU_CONTRIBUTOR, RoleKey.FINANCE_APPROVER])) {
    return ownsTask || onTaskTeam || isCaseOwner || onCaseTeam;
  }

  if (hasAnyRole(user, [RoleKey.LEADERSHIP_READONLY])) {
    return true;
  }

  return onCaseTeam || isCaseOwner || ownsTask;
}

/**
 * Case-level mutations (status, owner, fields). BU/Finance act on tasks, not the case header in this prototype.
 */
export function canUpdateCase(user: SessionUser, row: CaseUpdateRow): boolean {
  if (!canViewCase(user, row)) return false;
  if (isReadOnlyDemoUser(user)) return false;
  if (isPlatformAdmin(user)) return true;
  if (hasAnyRole(user, [RoleKey.CX_OPS])) return true;
  if (hasAnyRole(user, [RoleKey.ACCOUNT_TEAM]) && row.requesterId === user.id) {
    return row.status === CaseStatus.Draft || row.status === CaseStatus.AwaitingInfo;
  }
  return false;
}

/**
 * Task-level updates. BU/Finance limited to assigned work (including unowned team-queue tasks);
 * CX Ops / admin broader; account team only on info tasks.
 */
export function canUpdateTask(user: SessionUser, task: TaskAccessRow, caseRow: CaseAccessRow): boolean {
  if (!canViewCase(user, caseRow)) return false;
  if (isReadOnlyDemoUser(user)) return false;
  if (isPlatformAdmin(user)) return true;
  if (hasAnyRole(user, [RoleKey.CX_OPS])) return true;

  const teamIds = userTeamIds(user);
  const onTask =
    task.ownerId === user.id || (!!task.assignedTeamId && teamIds.has(task.assignedTeamId));
  const unownedTeamTask = canActOnUnownedTeamTask(user, task);

  if (hasAnyRole(user, [RoleKey.BU_CONTRIBUTOR, RoleKey.FINANCE_APPROVER])) {
    return onTask || unownedTeamTask;
  }

  if (hasAnyRole(user, [RoleKey.ACCOUNT_TEAM]) && caseRow.requesterId === user.id) {
    return task.type === TaskType.AdditionalInfoRequest;
  }

  return false;
}

/** Reports are for operations/leadership and scoped BU/Finance views; account-only users are excluded. */
export function canViewReports(user: SessionUser): boolean {
  if (hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN, RoleKey.LEADERSHIP_READONLY])) return true;
  if (hasAnyRole(user, [RoleKey.BU_CONTRIBUTOR, RoleKey.FINANCE_APPROVER])) return true;
  return false;
}

/** Leadership demo: read-only — block mutations in server actions and future forms. */
export function isReadOnlyDemoUser(user: SessionUser): boolean {
  return isLeadershipReadonly(user) && !isPlatformAdmin(user);
}
