import type { Prisma } from "@prisma/client";
import { CaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewCase, type CaseAccessRow } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth/session";

const caseListInclude = {
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, email: true } },
  assignedTeam: { select: { id: true, name: true } },
  _count: { select: { assets: true } },
  assets: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { id: true, platformName: true } },
  tasks: {
    select: {
      id: true,
      ownerId: true,
      assignedTeamId: true,
      assignedTeam: { select: { id: true, name: true } },
      status: true,
      type: true,
      isRequired: true,
      isRunnable: true,
      activatedAt: true,
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
    assets: true;
    tasks: { include: { owner: true; assignedTeam: true; caseAsset: true } };
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
      assets: { orderBy: { sortOrder: "asc" } },
      tasks: { include: { owner: true, assignedTeam: true, caseAsset: true } },
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
      assets: { orderBy: { sortOrder: "asc" } },
      attachments: {
        where: { filePath: { startsWith: "demo://" } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Full asset rows, routing owner label, and task fields for reporting (same `canViewCase` scope as the case list). */
const reportsCaseInclude = {
  owner: { select: { id: true, name: true } },
  assets: { orderBy: { sortOrder: "asc" as const } },
  tasks: {
    select: {
      ownerId: true,
      assignedTeamId: true,
      type: true,
      status: true,
      isRunnable: true,
      activatedAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.CaseInclude;

export type CaseReportsRow = Prisma.CaseGetPayload<{ include: typeof reportsCaseInclude }>;

function visibilityFromReportsRow(row: CaseReportsRow): CaseAccessRow {
  return {
    requesterId: row.requesterId,
    ownerId: row.ownerId,
    assignedTeamId: row.assignedTeamId,
    taskOwnerIds: row.tasks.map((t) => t.ownerId).filter(Boolean) as string[],
    taskTeamIds: row.tasks.map((t) => t.assignedTeamId).filter(Boolean) as string[],
  };
}

export async function listCasesForReports(user: SessionUser): Promise<CaseReportsRow[]> {
  const rows = await prisma.case.findMany({
    include: reportsCaseInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rows.filter((r) => canViewCase(user, visibilityFromReportsRow(r)));
}
