/** Helpers for `TaskAssignee` + legacy `Task.ownerId` (union = “directly assigned” users). */

export type TaskWithDirectAssignees = {
  ownerId: string | null;
  assignees: readonly { userId: string }[];
};

/** Unique user ids with a direct stake on this task (junction + optional legacy owner). */
export function mergedDirectAssigneeUserIds(task: TaskWithDirectAssignees): string[] {
  const s = new Set<string>();
  for (const a of task.assignees) {
    if (a.userId) s.add(a.userId);
  }
  if (task.ownerId) s.add(task.ownerId);
  return [...s];
}

/** Flatten direct assignees across all tasks on a case (for `CaseAccessRow.taskOwnerIds`). */
export function caseLevelTaskDirectUserIds(
  tasks: readonly TaskWithDirectAssignees[]
): string[] {
  const s = new Set<string>();
  for (const t of tasks) {
    for (const id of mergedDirectAssigneeUserIds(t)) s.add(id);
  }
  return [...s];
}

/** True when no individual is directly assigned (team-queue pickup may still apply). */
export function taskHasNoDirectAssignees(task: TaskWithDirectAssignees): boolean {
  return mergedDirectAssigneeUserIds(task).length === 0;
}

/** Minimal task shape for home / list “my work” stake checks (null-safe `assignees`). */
export type TaskStakeProjection = {
  ownerId: string | null;
  assignedTeamId: string | null;
  assignees?: readonly { userId: string }[] | null;
};

/** True if `userId` is in `TaskAssignee` or matches legacy `Task.ownerId`. */
export function isUserDirectTaskAssignee(userId: string, task: TaskStakeProjection): boolean {
  if (task.ownerId === userId) return true;
  for (const a of task.assignees ?? []) {
    if (a.userId === userId) return true;
  }
  return false;
}

/**
 * Direct assignee on the task, or member of the task’s assigned team (queue).
 * Used by Home “my work” and `/cases` “My work” so every multi-assignee sees shared tasks in dashboard lists.
 */
export function userHasOperationalTaskTie(
  userId: string,
  userTeamIds: Set<string>,
  task: TaskStakeProjection
): boolean {
  if (isUserDirectTaskAssignee(userId, task)) return true;
  const tid = task.assignedTeamId;
  return tid != null && userTeamIds.has(tid);
}
