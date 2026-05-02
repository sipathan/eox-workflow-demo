"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { CaseStatus, EssMssSupportSubtype, RequestType, RoleKey, TeamType } from "@prisma/client";
import { publicCaseIdTypeToken } from "@/lib/cases/case-id-prefix";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import { hasAnyRole, isReadOnlyDemoUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { buildSubmittedCaseTaskRows } from "@/lib/workflow/task-templates";
import {
  draftCaseSchema,
  submitCaseSchema,
  type CaseAssetRowInput,
  type DraftCaseInput,
  type IntakeAttachmentInput,
  type SubmitCaseInput,
} from "@/lib/validations/case";
import { normalizeMoneyInput } from "@/lib/cases/financials";

function canCreateCase(user: SessionUser): boolean {
  if (isReadOnlyDemoUser(user)) return false;
  return hasAnyRole(user, [RoleKey.ACCOUNT_TEAM, RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
}

export type CaseIntakeResult = { ok: true; id: string } | { ok: false; error: string };

function firstZodMessage(err: { issues: { message: string }[] }): string {
  return err.issues[0]?.message ?? "Invalid form.";
}

/** Public case id: `{typeToken}-{YYYY}-{XXXXXX}` — `typeToken` from `publicCaseIdTypeToken` (ESS_MSS → ESSMSS). */
export async function generateUniqueCaseId(requestType: RequestType): Promise<string> {
  const token = publicCaseIdTypeToken(requestType);
  const y = new Date().getUTCFullYear();
  for (let i = 0; i < 16; i++) {
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const caseId = `${token}-${y}-${suffix}`;
    const exists = await prisma.case.findUnique({ where: { caseId }, select: { id: true } });
    if (!exists) return caseId;
  }
  return `${token}-${y}-${randomBytes(4).toString("hex").toUpperCase()}`;
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
  const isEss = data.requestType === RequestType.ESS_MSS;
  const essNull = {
    essSupportSubtype: null,
    migrationTimeline: null,
    targetReplacementProduct: null,
    hardwarePhysicalLocation: null,
    softwareDeploymentType: null,
    softwareProductFamily: null,
    softwareOnPremise: null,
    softwarePerpetualLicense: null,
    softwareIsApplicationSoftware: null,
    softwareNotIosIosXr: null,
    environmentIsProduction: null,
    essEligibilityAcknowledged: false,
  };
  const essPayload = isEss
    ? {
        essSupportSubtype: data.essSupportSubtype ?? null,
        migrationTimeline: data.migrationTimeline?.trim() || null,
        targetReplacementProduct: data.targetReplacementProduct?.trim() || null,
        hardwarePhysicalLocation: data.hardwarePhysicalLocation?.trim() || null,
        softwareDeploymentType: data.softwareDeploymentType?.trim() || null,
        softwareProductFamily: data.softwareProductFamily?.trim() || null,
        softwareOnPremise: data.softwareOnPremise ?? null,
        softwarePerpetualLicense: data.softwarePerpetualLicense ?? null,
        softwareIsApplicationSoftware: data.softwareIsApplicationSoftware ?? null,
        softwareNotIosIosXr: data.softwareNotIosIosXr ?? null,
        environmentIsProduction: data.environmentIsProduction ?? null,
        essEligibilityAcknowledged: Boolean(data.essEligibilityAcknowledged),
      }
    : essNull;

  return {
    requestType: data.requestType,
    priority: data.priority,
    customerName: isDraft ? draftOrValue(data.customerName, "TBD") : data.customerName.trim(),
    dealId: (data.dealId ?? "").trim() ? (data.dealId ?? "").trim() : null,
    platform: null,
    softwareVersion: null,
    businessJustification: isDraft
      ? draftOrValue(data.businessJustification, "Pending — draft intake not yet completed.")
      : data.businessJustification.trim(),
    migrationPlan: data.migrationPlan?.trim() || null,
    extensionStartDate: parseDateInput(data.extensionStartDate),
    extensionEndDate: parseDateInput(data.extensionEndDate),
    partnerName: data.partnerName?.trim() || null,
    quantity: data.quantity ?? null,
    eolBulletinLink: null,
    serialNumbers: null,
    supportCoverageIndicator: data.supportCoverageIndicator?.trim() || null,
    hwLdosDate: null,
    notes: data.notes?.trim() || null,
    ...essPayload,
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

type CaseAssetRowWrite = Omit<Prisma.CaseAssetCreateManyInput, "caseId">;

/** Rows the user started filling (non-empty platform name); used for draft persistence. */
function filterPersistableAssetRows(rows: CaseAssetRowInput[]): CaseAssetRowInput[] {
  return rows.filter((a) => (a.platformName ?? "").trim().length > 0);
}

function assetRowsFromSubmit(rows: CaseAssetRowInput[]): CaseAssetRowWrite[] {
  return rows.map((a, i) => ({
    sortOrder: i,
    platformName: a.platformName.trim(),
    serialNumbers: a.serialNumbers?.trim() || null,
    eolBulletinLink: a.eolBulletinLink ?? null,
    hwLdosDate: parseDateInput(a.hwLdosDate),
    softwareVersion: a.softwareVersion?.trim() || null,
    buCost: normalizeMoneyInput(a.buCost ?? 0),
    cxCost: normalizeMoneyInput(a.cxCost ?? 0),
  }));
}

async function replaceCaseAssets(
  tx: Prisma.TransactionClient,
  caseId: string,
  rows: CaseAssetRowWrite[]
): Promise<string[]> {
  await tx.caseAsset.deleteMany({ where: { caseId } });
  if (rows.length === 0) return [];
  const created = await Promise.all(
    rows.map((r) =>
      tx.caseAsset.create({
        data: {
          caseId,
          sortOrder: r.sortOrder ?? 0,
          platformName: String(r.platformName),
          serialNumbers: r.serialNumbers ?? null,
          eolBulletinLink: r.eolBulletinLink ?? null,
          hwLdosDate: r.hwLdosDate ?? null,
          softwareVersion: r.softwareVersion ?? null,
          buCost: r.buCost ?? 0,
          cxCost: r.cxCost ?? 0,
        },
      })
    )
  );
  return created.map((c) => c.id);
}

async function bootstrapSubmittedCaseTasks(
  tx: Prisma.TransactionClient,
  caseId: string,
  assetIds: string[],
  cxOpsTeamId: string | null,
  buQueueId: string | null,
  template: { requestType: RequestType; essSupportSubtype: EssMssSupportSubtype | null }
): Promise<void> {
  const now = new Date();
  const payload = buildSubmittedCaseTaskRows({
    caseId,
    assetIds,
    cxOpsTeamId,
    buQueueId,
    now,
    requestType: template.requestType,
    essSupportSubtype: template.essSupportSubtype,
  });
  await tx.task.createMany({ data: payload });
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
  const persistableAssets = filterPersistableAssetRows(data.assets ?? []);
  const assetRows = assetRowsFromSubmit(persistableAssets);

  try {
    if (data.draftCaseInternalId) {
      const existing = await prisma.case.findFirst({
        where: { id: data.draftCaseInternalId, requesterId: user.id, status: CaseStatus.Draft },
        select: { id: true, caseId: true },
      });
      if (!existing) return { ok: false, error: "Draft not found or you cannot edit it." };

      await prisma.$transaction(async (tx) => {
        await tx.case.update({
          where: { id: existing.id },
          data: { ...base, status: CaseStatus.Draft },
        });
        await replaceCaseAssets(tx, existing.id, assetRows);
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

    const caseId = await generateUniqueCaseId(data.requestType);
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.case.create({
        data: {
          ...base,
          caseId,
          status: CaseStatus.Draft,
          requesterId: user.id,
          assignedTeamId: null,
        },
      });
      await replaceCaseAssets(tx, c.id, assetRows);
      return c;
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
  const assetRows = assetRowsFromSubmit(data.assets);

  const cxOpsTeam = await prisma.team.findFirst({
    where: { type: TeamType.CX_OPERATIONS },
    select: { id: true },
  });
  const buQueue = await prisma.team.findFirst({
    where: { type: TeamType.BU_QUEUE },
    select: { id: true },
  });

  try {
    if (data.draftCaseInternalId) {
      const existing = await prisma.case.findFirst({
        where: { id: data.draftCaseInternalId, requesterId: user.id, status: CaseStatus.Draft },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Draft not found or already submitted." };

      await prisma.$transaction(async (tx) => {
        await tx.case.update({
          where: { id: existing.id },
          data: {
            ...base,
            status: CaseStatus.Submitted,
            assignedTeamId: cxOpsTeam?.id ?? null,
          },
        });
        const assetIds = await replaceCaseAssets(tx, existing.id, assetRows);
        await tx.task.deleteMany({ where: { caseId: existing.id } });
        await bootstrapSubmittedCaseTasks(tx, existing.id, assetIds, cxOpsTeam?.id ?? null, buQueue?.id ?? null, {
          requestType: data.requestType,
          essSupportSubtype: data.essSupportSubtype ?? null,
        });
      });

      await replaceDemoAttachments(existing.id, user.id, attachments);
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

    const publicCaseId = await generateUniqueCaseId(data.requestType);
    const createdId = await prisma.$transaction(async (tx) => {
      const c = await tx.case.create({
        data: {
          ...base,
          caseId: publicCaseId,
          status: CaseStatus.Submitted,
          requesterId: user.id,
          assignedTeamId: cxOpsTeam?.id ?? null,
        },
      });
      const assetIds = await replaceCaseAssets(tx, c.id, assetRows);
      await bootstrapSubmittedCaseTasks(tx, c.id, assetIds, cxOpsTeam?.id ?? null, buQueue?.id ?? null, {
        requestType: data.requestType,
        essSupportSubtype: data.essSupportSubtype ?? null,
      });
      return c.id;
    });

    await replaceDemoAttachments(createdId, user.id, attachments);
    await prisma.activityLog.create({
      data: {
        caseId: createdId,
        userId: user.id,
        action: "case_submitted",
        details: `Submitted as ${publicCaseId} to CX operations queue.`,
      },
    });
    revalidatePath("/cases");
    revalidatePath("/");
    return { ok: true, id: createdId };
  } catch {
    return { ok: false, error: "Could not submit request. Try again." };
  }
}
