import type { Case } from "@prisma/client";
import type { CaseAccessRow } from "@/lib/rbac";
import { caseLevelTaskDirectUserIds, type TaskWithDirectAssignees } from "@/lib/tasks/direct-assignees";

/**
 * Distinct task `assignedTeamId` values across **all** tasks (any status).
 * Used for case visibility: queue membership on a task counts as assignment (PROJECT_CONTEXT).
 */
export function taskTeamIdsFromAllTasks(tasks: readonly { assignedTeamId: string | null }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tasks) {
    const id = t.assignedTeamId;
    if (id != null && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Single source of truth for `CaseAccessRow` construction (list, detail, reports, server actions).
 * Direct assignees include multi-assignee rows + legacy `Task.ownerId`.
 */
/** Task fields needed to build `CaseAccessRow` (direct assignees + queue ids). */
export type TaskSliceForCaseAccess = TaskWithDirectAssignees & { assignedTeamId: string | null };

export function buildCaseAccessRow(
  base: Pick<Case, "requesterId" | "ownerId" | "assignedTeamId">,
  tasks: readonly TaskSliceForCaseAccess[]
): CaseAccessRow {
  return {
    requesterId: base.requesterId,
    ownerId: base.ownerId,
    assignedTeamId: base.assignedTeamId,
    taskOwnerIds: caseLevelTaskDirectUserIds(tasks),
    taskTeamIds: taskTeamIdsFromAllTasks(tasks),
  };
}
