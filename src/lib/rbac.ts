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
  /** Union of all users with a direct task stake (`TaskAssignee` ∪ `Task.ownerId`) across tasks on the case (all statuses). */
  taskOwnerIds: string[];
  /** Distinct task queue ids from **all** tasks; used with `taskOwnerIds` for non–CX case visibility. */
  taskTeamIds: string[];
};

export type CaseUpdateRow = CaseAccessRow & Pick<Case, "status">;

/** Task-level auth projection: team queue + runnable + direct assignees (M2M + legacy `ownerId`). */
export type TaskAccessRow = Pick<Task, "ownerId" | "assignedTeamId" | "type" | "isRunnable"> & {
  /** User ids with a direct assignment (`TaskAssignee` ∪ `ownerId`). */
  assigneeUserIds: readonly string[];
};

function userTeamIds(user: SessionUser): Set<string> {
  return new Set(user.teams.map((t) => t.id));
}

/**
 * Team queue behavior: an unowned task can still be actioned by users on the assigned team
 * when their role permits task updates.
 */
export function canActOnUnownedTeamTask(user: SessionUser, task: TaskAccessRow): boolean {
  if (task.ownerId || task.assigneeUserIds.length > 0) return false;
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
 * Whether the user may see a case in list/detail/reports.
 * Aligns with `docs/PROJECT_CONTEXT.md` roles:
 * — **CX Operations**: all cases (workflow operator).
 * — **Platform admin** / **Leadership (read-only)**: all cases.
 * — **Everyone else**: only cases they **created** (`requesterId`) or where they are on a task — **direct assignee**
 *   (multi-assignee + `ownerId`) or **task queue** member — for **any** task status (active or historical).
 */
export function canViewCase(user: SessionUser, row: CaseAccessRow): boolean {
  if (isPlatformAdmin(user)) return true;
  if (hasAnyRole(user, [RoleKey.LEADERSHIP_READONLY])) return true;
  if (hasAnyRole(user, [RoleKey.CX_OPS])) return true;

  const teamIds = userTeamIds(user);
  const createdCase = row.requesterId === user.id;
  const onTaskDirect = row.taskOwnerIds.includes(user.id);
  const onTaskQueue = row.taskTeamIds.some((id) => teamIds.has(id));
  return createdCase || onTaskDirect || onTaskQueue;
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

  if (!task.isRunnable) {
    return false;
  }

  const teamIds = userTeamIds(user);
  const isDirectAssignee = task.assigneeUserIds.includes(user.id) || task.ownerId === user.id;
  const onTask = isDirectAssignee || (!!task.assignedTeamId && teamIds.has(task.assignedTeamId));
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

/** Intake / new request — matches `NewCasePage` gate (BU/Finance excluded; read-only leadership excluded). */
export function canCreateRequest(user: SessionUser): boolean {
  if (isReadOnlyDemoUser(user)) return false;
  return hasAnyRole(user, [RoleKey.ACCOUNT_TEAM, RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
}

/** Leadership demo: read-only — block mutations in server actions and future forms. */
export function isReadOnlyDemoUser(user: SessionUser): boolean {
  return isLeadershipReadonly(user) && !isPlatformAdmin(user);
}

/**
 * Users who see the **full** case portfolio under `canViewCase` (CX Ops, Platform Admin, Leadership).
 * Used to align list/home counts with “portfolio-wide” vs “scoped to my involvement” UX.
 */
export function isPortfolioWideCaseViewer(user: SessionUser): boolean {
  if (isPlatformAdmin(user)) return true;
  return hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.LEADERSHIP_READONLY]);
}
