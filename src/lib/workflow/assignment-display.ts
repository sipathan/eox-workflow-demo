import type { Case, Task, Team, User } from "@prisma/client";

type CaseAssignmentView = Pick<Case, "ownerId" | "assignedTeamId"> & {
  owner: Pick<User, "name"> | null;
  assignedTeam: Pick<Team, "name"> | null;
};

type TaskAssignmentView = Pick<Task, "ownerId" | "assignedTeamId"> & {
  owner: Pick<User, "name"> | null;
  assignedTeam: Pick<Team, "name"> | null;
};

export function ownershipDisplayForCase(c: CaseAssignmentView): string {
  if (c.owner) return c.owner.name;
  return "Unassigned";
}

export function assignedTeamFallbackLabelForCase(c: CaseAssignmentView): string {
  return c.assignedTeam?.name ?? "—";
}

export function ownershipDisplayForTask(t: TaskAssignmentView): string {
  const owner = t.owner?.name ?? "Unassigned";
  const team = t.assignedTeam?.name ?? "—";
  return `${owner} · ${team}`;
}
