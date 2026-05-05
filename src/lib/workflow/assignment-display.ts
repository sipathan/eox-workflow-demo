import type { Case, Task, Team, User } from "@prisma/client";

type CaseAssignmentView = Pick<Case, "ownerId" | "assignedTeamId"> & {
  owner: Pick<User, "name"> | null;
  assignedTeam: Pick<Team, "name"> | null;
};

type TaskAssignmentView = Pick<Task, "ownerId" | "assignedTeamId"> & {
  owner: Pick<User, "name"> | null;
  assignedTeam: Pick<Team, "name"> | null;
  assignees?: readonly { userId: string; user: Pick<User, "name"> }[];
};

export function ownershipDisplayForCase(c: CaseAssignmentView): string {
  if (c.owner) return c.owner.name;
  return "Unassigned";
}

export function assignedTeamFallbackLabelForCase(c: CaseAssignmentView): string {
  return c.assignedTeam?.name ?? "—";
}

/** Human-readable direct assignees (junction + legacy `owner`), deduped by name. */
/** Stable list for UI chips: junction rows first, then legacy `owner` if not already listed. */
export function orderedTaskAssigneesForDisplay(
  t: TaskAssignmentView
): readonly { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const a of t.assignees ?? []) {
    const id = a.userId;
    const name = a.user?.name?.trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
  }
  if (t.ownerId && t.owner?.name && !seen.has(t.ownerId)) {
    out.push({ id: t.ownerId, name: t.owner.name });
  }
  return out;
}

export function assigneeNamesForTask(t: TaskAssignmentView): string {
  const list = orderedTaskAssigneesForDisplay(t);
  if (list.length === 0) return "Unassigned";
  return list.map((x) => x.name).join(", ");
}

export function ownershipDisplayForTask(t: TaskAssignmentView): string {
  const people = assigneeNamesForTask(t);
  const team = t.assignedTeam?.name ?? "—";
  return `${people} · ${team}`;
}
