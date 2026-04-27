import type { Prisma } from "@prisma/client";
import { CaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewCase, type CaseAccessRow } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth/session";

const caseListInclude = {
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, email: true } },
  assignedTeam: { select: { id: true, name: true } },
  tasks: {
    select: {
      id: true,
      ownerId: true,
      assignedTeamId: true,
      assignedTeam: { select: { id: true, name: true } },
      status: true,
      type: true,
      isRequired: true,
      dueDate: true,
    },
  },
} satisfies Prisma.CaseInclude;

export type CaseListRow = Prisma.CaseGetPayload<{ include: typeof caseListInclude }>;

function visibilityRow(row: CaseListRow): CaseAccessRow {
  return {
    requesterId: row.requesterId,
    ownerId: row.ownerId,
    assignedTeamId: row.assignedTeamId,
    taskOwnerIds: row.tasks.map((t) => t.ownerId).filter(Boolean) as string[],
    taskTeamIds: row.tasks.map((t) => t.assignedTeamId).filter(Boolean) as string[],
  };
}

export async function listCasesVisibleToUser(user: SessionUser): Promise<CaseListRow[]> {
  const rows = await prisma.case.findMany({
    include: caseListInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rows.filter((r) => canViewCase(user, visibilityRow(r)));
}

export async function getCaseByIdForUser(
  user: SessionUser,
  id: string
): Promise<Prisma.CaseGetPayload<{
  include: {
    requester: true;
    owner: true;
    assignedTeam: true;
    tasks: { include: { owner: true; assignedTeam: true } };
    comments: { include: { user: true }; orderBy: { createdAt: "desc" } };
    activities: { include: { user: true }; orderBy: { createdAt: "desc" } };
    references: true;
    attachments: { include: { uploadedBy: true } };
  };
}> | null> {
  const row = await prisma.case.findUnique({
    where: { id },
    include: {
      requester: true,
      owner: true,
      assignedTeam: true,
      tasks: { include: { owner: true, assignedTeam: true } },
      comments: { include: { user: true }, orderBy: { createdAt: "desc" } },
      activities: { include: { user: true }, orderBy: { createdAt: "desc" } },
      references: true,
      attachments: { include: { uploadedBy: true } },
    },
  });
  if (!row) return null;
  const vis = {
    requesterId: row.requesterId,
    ownerId: row.ownerId,
    assignedTeamId: row.assignedTeamId,
    taskOwnerIds: row.tasks.map((t) => t.ownerId).filter(Boolean) as string[],
    taskTeamIds: row.tasks.map((t) => t.assignedTeamId).filter(Boolean) as string[],
  };
  if (!canViewCase(user, vis)) return null;
  return row;
}

export function myWorkCases(user: SessionUser, rows: CaseListRow[]): CaseListRow[] {
  return rows.filter((r) => {
    if (r.ownerId === user.id) return true;
    if (r.requesterId === user.id) return true;
    const teamIds = new Set(user.teams.map((t) => t.id));
    if (r.assignedTeamId && teamIds.has(r.assignedTeamId)) return true;
    return r.tasks.some(
      (t) => t.ownerId === user.id || (!!t.assignedTeamId && teamIds.has(t.assignedTeamId))
    );
  });
}

/** Editable draft owned by the current user (for /cases/new?draft=). */
export async function getDraftCaseForUser(user: SessionUser, id: string) {
  return prisma.case.findFirst({
    where: { id, requesterId: user.id, status: CaseStatus.Draft },
    include: {
      attachments: {
        where: { filePath: { startsWith: "demo://" } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
