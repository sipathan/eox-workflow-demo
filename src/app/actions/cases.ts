"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { CaseStatus, RoleKey, TaskStatus, TaskType, TeamType } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import { hasAnyRole, isReadOnlyDemoUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  draftCaseSchema,
  submitCaseSchema,
  type DraftCaseInput,
  type IntakeAttachmentInput,
  type SubmitCaseInput,
} from "@/lib/validations/case";

function canCreateCase(user: SessionUser): boolean {
  if (isReadOnlyDemoUser(user)) return false;
  return hasAnyRole(user, [RoleKey.ACCOUNT_TEAM, RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
}

export type CaseIntakeResult = { ok: true; id: string } | { ok: false; error: string };

function firstZodMessage(err: { issues: { message: string }[] }): string {
  return err.issues[0]?.message ?? "Invalid form.";
}

async function generateUniqueCaseId(): Promise<string> {
  const y = new Date().getUTCFullYear();
  for (let i = 0; i < 12; i++) {
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const caseId = `EOX-${y}-${suffix}`;
    const exists = await prisma.case.findUnique({ where: { caseId }, select: { id: true } });
    if (!exists) return caseId;
  }
  return `EOX-${y}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function parseDateInput(s: string | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function draftOrValue(s: string, placeholder: string): string {
  const t = s.trim();
  return t.length > 0 ? t : placeholder;
}

function toCaseWriteData(data: DraftCaseInput | SubmitCaseInput, opts: { isDraft: boolean }) {
  const isDraft = opts.isDraft;
  return {
    requestType: data.requestType,
    priority: data.priority,
    customerName: isDraft ? draftOrValue(data.customerName, "TBD") : data.customerName.trim(),
    dealId: isDraft ? draftOrValue(data.dealId, "TBD") : data.dealId.trim(),
    platform: isDraft ? draftOrValue(data.platform, "TBD") : data.platform.trim(),
    softwareVersion: isDraft ? draftOrValue(data.softwareVersion, "TBD") : data.softwareVersion.trim(),
    businessJustification: isDraft
      ? draftOrValue(data.businessJustification, "Pending — draft intake not yet completed.")
      : data.businessJustification.trim(),
    migrationPlan: data.migrationPlan?.trim() || null,
    extensionStartDate: parseDateInput(data.extensionStartDate),
    extensionEndDate: parseDateInput(data.extensionEndDate),
    partnerName: data.partnerName?.trim() || null,
    quantity: data.quantity ?? null,
    eolBulletinLink: data.eolBulletinLink ?? null,
    serialNumbers: data.serialNumbers ?? null,
    supportCoverageIndicator: data.supportCoverageIndicator?.trim() || null,
    hwLdosDate: parseDateInput(data.hwLdosDate),
    notes: data.notes?.trim() || null,
  };
}

async function replaceDemoAttachments(
  caseId: string,
  userId: string,
  attachments: IntakeAttachmentInput[]
): Promise<void> {
  await prisma.attachment.deleteMany({
    where: { caseId, filePath: { startsWith: "demo://" } },
  });
  if (attachments.length === 0) return;
  await prisma.attachment.createMany({
    data: attachments.map((a) => ({
      caseId,
      fileName: a.fileName,
      filePath: `demo://local/${caseId}/${encodeURIComponent(a.fileName)}`,
      uploadedById: userId,
      mimeType: a.mimeType ?? null,
      sizeBytes: a.sizeBytes ?? null,
    })),
  });
}

async function ensureIntakeValidationTask(caseId: string): Promise<void> {
  const existing = await prisma.task.findFirst({
    where: { caseId, type: TaskType.IntakeValidation },
    select: { id: true },
  });
  if (existing) return;
  await prisma.task.create({
    data: {
      caseId,
      type: TaskType.IntakeValidation,
      status: TaskStatus.NotStarted,
      isRequired: true,
    },
  });
}

export async function saveCaseDraftAction(raw: unknown): Promise<CaseIntakeResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!canCreateCase(user)) return { ok: false, error: "You do not have permission to create cases." };

  const parsed = draftCaseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodMessage(parsed.error) };

  const data = parsed.data;
  const base = toCaseWriteData(data, { isDraft: true });
  const attachments = data.attachments ?? [];

  try {
    if (data.draftCaseInternalId) {
      const existing = await prisma.case.findFirst({
        where: { id: data.draftCaseInternalId, requesterId: user.id, status: CaseStatus.Draft },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Draft not found or you cannot edit it." };

      await prisma.case.update({
        where: { id: existing.id },
        data: { ...base, status: CaseStatus.Draft },
      });
      await replaceDemoAttachments(existing.id, user.id, attachments);
      await prisma.activityLog.create({
        data: {
          caseId: existing.id,
          userId: user.id,
          action: "draft_saved",
          details: "Draft intake updated.",
        },
      });
      revalidatePath("/cases");
      revalidatePath("/");
      revalidatePath(`/cases/${existing.id}`);
      return { ok: true, id: existing.id };
    }

    const caseId = await generateUniqueCaseId();
    const created = await prisma.case.create({
      data: {
        ...base,
        caseId,
        status: CaseStatus.Draft,
        requesterId: user.id,
        assignedTeamId: null,
      },
    });
    await replaceDemoAttachments(created.id, user.id, attachments);
    await prisma.activityLog.create({
      data: {
        caseId: created.id,
        userId: user.id,
        action: "draft_created",
        details: `Draft saved as ${caseId}.`,
      },
    });
    revalidatePath("/cases");
    revalidatePath("/");
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: "Could not save draft. Try again." };
  }
}

export async function submitCaseIntakeAction(raw: unknown): Promise<CaseIntakeResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!canCreateCase(user)) return { ok: false, error: "You do not have permission to create cases." };

  const parsed = submitCaseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodMessage(parsed.error) };

  const data = parsed.data;
  const base = toCaseWriteData(data, { isDraft: false });
  const attachments = data.attachments ?? [];

  const cxOpsTeam = await prisma.team.findFirst({
    where: { type: TeamType.CX_OPERATIONS },
    select: { id: true },
  });

  try {
    if (data.draftCaseInternalId) {
      const existing = await prisma.case.findFirst({
        where: { id: data.draftCaseInternalId, requesterId: user.id, status: CaseStatus.Draft },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Draft not found or already submitted." };

      await prisma.case.update({
        where: { id: existing.id },
        data: {
          ...base,
          status: CaseStatus.Submitted,
          assignedTeamId: cxOpsTeam?.id ?? null,
        },
      });
      await replaceDemoAttachments(existing.id, user.id, attachments);
      await ensureIntakeValidationTask(existing.id);
      await prisma.activityLog.create({
        data: {
          caseId: existing.id,
          userId: user.id,
          action: "case_submitted",
          details: "Request submitted to CX operations queue.",
        },
      });
      revalidatePath("/cases");
      revalidatePath("/");
      revalidatePath(`/cases/${existing.id}`);
      return { ok: true, id: existing.id };
    }

    const caseId = await generateUniqueCaseId();
    const created = await prisma.case.create({
      data: {
        ...base,
        caseId,
        status: CaseStatus.Submitted,
        requesterId: user.id,
        assignedTeamId: cxOpsTeam?.id ?? null,
        tasks: {
          create: [
            {
              type: TaskType.IntakeValidation,
              status: TaskStatus.NotStarted,
              isRequired: true,
            },
          ],
        },
      },
    });
    await replaceDemoAttachments(created.id, user.id, attachments);
    await prisma.activityLog.create({
      data: {
        caseId: created.id,
        userId: user.id,
        action: "case_submitted",
        details: `Submitted as ${caseId} to CX operations queue.`,
      },
    });
    revalidatePath("/cases");
    revalidatePath("/");
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: "Could not submit request. Try again." };
  }
}
