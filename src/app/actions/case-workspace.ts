"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CaseStatus,
  ExternalReferenceIntegrationState,
  ExternalReferenceType,
  Prisma,
  QuoteBookingStatus,
  RoleKey,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { applyTaskActivationRules } from "@/lib/workflow/task-activation";
import {
  canTriggerSalesforceIbCaseCreation,
  canUpdateCase,
  canUpdateTask,
  canViewCase,
  hasAnyRole,
  isReadOnlyDemoUser,
  type CaseAccessRow,
  type CaseUpdateRow,
  type TaskAccessRow,
} from "@/lib/rbac";
import { mergedDirectAssigneeUserIds } from "@/lib/tasks/direct-assignees";
import {
  addAttachmentMetadataSchema,
  addCommentSchema,
  caseAssetCostsUpdateSchema,
  caseAssignmentUpdateSchema,
  caseBookingUpdateSchema,
  caseStatusUpdateSchema,
  createSalesforceIbCaseSchema,
  createTaskSchema,
  updateTaskSchema,
  upsertExternalReferenceSchema,
} from "@/lib/validations/case-workspace";
import { normalizeMoneyInput } from "@/lib/cases/financials";
import { buildCaseAccessRow } from "@/lib/permissions/case-access-projection";
import { SALESFORCE_EXTERNAL_SYSTEM_NAME } from "@/lib/external-references/integration-reference";
import {
  evaluateSalesforceIbCreationEligibility,
  getSalesforceIbProvider,
  hasSuccessfulSalesforceIbReference,
  mapEoXCaseToSalesforceIbPayload,
} from "@/lib/integrations/salesforce-ib";

const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  Draft: [CaseStatus.Submitted, CaseStatus.Cancelled],
  Submitted: [
    CaseStatus.InReview,
    CaseStatus.AwaitingInfo,
    CaseStatus.Blocked,
    CaseStatus.Rejected,
    CaseStatus.Cancelled,
  ],
  InReview: [
    CaseStatus.AwaitingInfo,
    CaseStatus.InProgress,
    CaseStatus.Blocked,
    CaseStatus.Rejected,
    CaseStatus.Cancelled,
  ],
  AwaitingInfo: [CaseStatus.InReview, CaseStatus.InProgress, CaseStatus.Blocked, CaseStatus.Cancelled],
  InProgress: [CaseStatus.Blocked, CaseStatus.ReadyForRelease, CaseStatus.Cancelled],
  Blocked: [CaseStatus.InProgress, CaseStatus.AwaitingInfo, CaseStatus.Cancelled, CaseStatus.Rejected],
  ReadyForRelease: [CaseStatus.Closed, CaseStatus.InProgress, CaseStatus.Blocked],
  Closed: [],
  Rejected: [],
  Cancelled: [],
};
const REASON_REQUIRED_STATUSES = new Set<CaseStatus>([
  CaseStatus.Blocked,
  CaseStatus.Rejected,
  CaseStatus.Cancelled,
]);
const COMPLETION_GATED_STATUSES = new Set<CaseStatus>([
  CaseStatus.ReadyForRelease,
  CaseStatus.Closed,
]);

function toCaseAccessRow(row: {
  requesterId: string;
  ownerId: string | null;
  assignedTeamId: string | null;
  tasks: {
    ownerId: string | null;
    assignedTeamId: string | null;
    status: TaskStatus;
    assignees: { userId: string }[];
  }[];
}): CaseAccessRow {
  return buildCaseAccessRow(row, row.tasks);
}

function toCaseUpdateRow(row: {
  requesterId: string;
  ownerId: string | null;
  assignedTeamId: string | null;
  status: CaseStatus;
  tasks: {
    ownerId: string | null;
    assignedTeamId: string | null;
    status: TaskStatus;
    assignees: { userId: string }[];
  }[];
}): CaseUpdateRow {
  return { ...toCaseAccessRow(row), status: row.status };
}

function toTaskAccessRow(task: {
  ownerId: string | null;
  assignedTeamId: string | null;
  type: TaskType;
  isRunnable: boolean;
  assignees: { userId: string }[];
}): TaskAccessRow {
  return {
    ownerId: task.ownerId,
    assignedTeamId: task.assignedTeamId,
    type: task.type,
    isRunnable: task.isRunnable,
    assigneeUserIds: mergedDirectAssigneeUserIds({
      ownerId: task.ownerId,
      assignees: task.assignees,
    }),
  };
}

function parseFormData(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    out[k] = String(v);
  }
  return out;
}

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function casePath(caseId: string): string {
  return `/cases/${caseId}`;
}

function goCase(caseId: string, message: string, tone: "ok" | "error" = "ok"): never {
  const qp = new URLSearchParams({ flash: message, tone });
  redirect(`${casePath(caseId)}?${qp.toString()}`);
}

async function getCaseOrRedirect(caseId: string) {
  const user = await getSessionUser();
  if (!user) goCase(caseId, "Not signed in.", "error");
  if (isReadOnlyDemoUser(user)) goCase(caseId, "This account is read-only.", "error");

  const row = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseId: true,
      status: true,
      requesterId: true,
      ownerId: true,
      assignedTeamId: true,
      tasks: {
        select: {
          id: true,
          ownerId: true,
          assignedTeamId: true,
          type: true,
          status: true,
          isRequired: true,
          isRunnable: true,
          activatedAt: true,
          caseAssetId: true,
          assignees: { select: { userId: true } },
        },
      },
    },
  });
  if (!row) goCase(caseId, "Case not found.", "error");
  if (!canViewCase(user, toCaseAccessRow(row))) goCase(caseId, "You are not allowed to view this case.", "error");

  return { user, row };
}

async function logActivity(caseId: string, userId: string, action: string, details?: string) {
  await prisma.activityLog.create({
    data: { caseId, userId, action, details },
  });
}

export async function updateCaseStatusAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = caseStatusUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid status update.", "error");
  }
  const { caseId, toStatus, reason } = parsed.data;
  const { user, row } = await getCaseOrRedirect(caseId);

  const canEditCase = canUpdateCase(user, toCaseUpdateRow(row));
  const canTransition =
    canEditCase && (hasAnyRole(user, [RoleKey.CX_OPS]) || user.roles.includes(RoleKey.PLATFORM_ADMIN));
  if (!canTransition) goCase(caseId, "You are not allowed to update case status.", "error");

  if (!CASE_STATUS_TRANSITIONS[row.status].includes(toStatus)) {
    goCase(caseId, `Transition ${row.status} → ${toStatus} is not allowed.`, "error");
  }
  if (REASON_REQUIRED_STATUSES.has(toStatus) && !reason) {
    goCase(caseId, `Reason is required when setting ${toStatus}.`, "error");
  }
  if (COMPLETION_GATED_STATUSES.has(toStatus)) {
    const incompleteRequired = row.tasks.some(
      (t) =>
        t.isRunnable &&
        t.isRequired &&
        t.status !== TaskStatus.Completed &&
        t.status !== TaskStatus.NotRequired
    );
    if (incompleteRequired) {
      goCase(caseId, `${toStatus} requires all required tasks to be completed.`, "error");
    }
  }

  await prisma.case.update({
    where: { id: caseId },
    data: { status: toStatus },
  });
  await logActivity(
    caseId,
    user.id,
    "case_status_changed",
    `${row.status} → ${toStatus}${reason ? ` | reason: ${reason}` : ""}`
  );

  revalidatePath(casePath(caseId));
  revalidatePath("/cases");
  revalidatePath("/");
  goCase(caseId, `Status updated to ${toStatus}.`);
}

export async function updateCaseAssignmentAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = caseAssignmentUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid assignment update.", "error");
  }
  const { caseId, ownerId, assignedTeamId, dealId, routingNote } = parsed.data;
  const { user, row } = await getCaseOrRedirect(caseId);
  const canManage =
    canUpdateCase(user, toCaseUpdateRow(row)) &&
    hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
  if (!canManage) goCase(caseId, "Only CX Ops/Admin can reassign case owner/team.", "error");

  await prisma.case.update({
    where: { id: caseId },
    data: {
      ownerId: ownerId ?? null,
      assignedTeamId: assignedTeamId ?? null,
      ...(dealId !== undefined ? { dealId } : {}),
      ...(routingNote !== undefined ? { routingNote } : {}),
    },
  });
  const noteLog =
    routingNote === undefined
      ? ""
      : routingNote
        ? ` | routingNote=${routingNote.length > 200 ? `${routingNote.slice(0, 200)}…` : routingNote}`
        : " | routingNote=cleared";
  await logActivity(
    caseId,
    user.id,
    "case_assignment_updated",
    `owner=${ownerId ?? "-"} team=${assignedTeamId ?? "-"}${dealId !== undefined ? ` dealId=${dealId ?? "cleared"}` : ""}${noteLog}`
  );
  revalidatePath(casePath(caseId));
  revalidatePath("/cases");
  goCase(caseId, "Case assignment updated.");
}

function assigneeIdsFromForm(formData: FormData): string[] {
  const ids = formData
    .getAll("assigneeUserId")
    .map((v) => String(v).trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid task form.", "error");
  const { caseId, type, assignedTeamId, dueDate, notes } = parsed.data;
  const assigneeUserIds = assigneeIdsFromForm(formData);
  const ownerId = assigneeUserIds[0] ?? null;
  const { user, row } = await getCaseOrRedirect(caseId);
  const canManage = hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]) && canUpdateCase(user, toCaseUpdateRow(row));
  if (!canManage) goCase(caseId, "Only CX Ops/Admin can create tasks.", "error");

  const created = await prisma.task.create({
    data: {
      caseId,
      type,
      status: TaskStatus.NotStarted,
      ownerId,
      assignedTeamId: assignedTeamId ?? null,
      dueDate: parseDateOrNull(dueDate),
      notes: notes ?? null,
      isRequired: true,
      isRunnable: true,
      activatedAt: new Date(),
      assignees:
        assigneeUserIds.length > 0
          ? {
              create: assigneeUserIds.map((uid) => ({
                userId: uid,
                assignedById: user.id,
              })),
            }
          : undefined,
    },
  });
  await logActivity(
    caseId,
    user.id,
    "task_created",
    `${created.type} (${created.id.slice(-6)}) assignees=${assigneeUserIds.length || "none"} team=${assignedTeamId ?? "-"}`
  );

  revalidatePath(casePath(caseId));
  goCase(caseId, "Task created.");
}

export async function updateTaskAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid task update.", "error");
  const payload = parsed.data;
  const { caseId, taskId } = payload;
  const { user, row } = await getCaseOrRedirect(caseId);
  const task = row.tasks.find((t) => t.id === taskId);
  if (!task) goCase(caseId, "Task not found on this case.", "error");

  const taskAccess = toTaskAccessRow(task);
  const canEditTask = canUpdateTask(user, taskAccess, toCaseAccessRow(row));
  if (!canEditTask) goCase(caseId, "You are not allowed to update this task.", "error");

  const canManageAssignments = hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
  if (payload.status === TaskStatus.Blocked && !payload.blockerReason?.trim()) {
    goCase(caseId, "Blocked tasks require blocker reason.", "error");
  }
  if (payload.status === TaskStatus.NotRequired && !payload.notRequiredReason?.trim()) {
    goCase(caseId, "Not Required tasks need a reason.", "error");
  }

  const status = payload.status;
  const isRequired = payload.status === TaskStatus.NotRequired ? false : payload.isRequired;
  if (isRequired && status === TaskStatus.NotRequired) {
    goCase(caseId, "Not Required status cannot stay marked required.", "error");
  }

  const assigneeUserIds = assigneeIdsFromForm(formData);
  const nextOwnerId = canManageAssignments ? assigneeUserIds[0] ?? null : task.ownerId;

  await prisma.$transaction(async (tx) => {
    if (canManageAssignments) {
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      if (assigneeUserIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: assigneeUserIds.map((uid) => ({
            taskId,
            userId: uid,
            assignedById: user.id,
          })),
        });
      }
    }
    await tx.task.update({
      where: { id: taskId },
      data: {
        status,
        notes: payload.notes?.trim() || null,
        blockerReason: status === TaskStatus.Blocked ? payload.blockerReason?.trim() || null : null,
        notRequiredReason: status === TaskStatus.NotRequired ? payload.notRequiredReason?.trim() || null : null,
        isRequired,
        ...(canManageAssignments
          ? {
              ownerId: nextOwnerId,
              assignedTeamId: payload.assignedTeamId ?? null,
              dueDate: parseDateOrNull(payload.dueDate),
            }
          : {}),
      },
    });
  });
  await logActivity(
    caseId,
    user.id,
    "task_updated",
    `${task.type} (${task.id.slice(-6)}) status=${status}${!isRequired ? " not-required" : ""}`
  );

  await applyTaskActivationRules(caseId);

  revalidatePath(casePath(caseId));
  goCase(caseId, "Task updated.");
}

export async function activateAdditionalInfoTaskAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const caseId = raw.caseId?.trim();
  if (!caseId) goCase(fallbackCaseId, "Missing case id.", "error");
  const { user, row } = await getCaseOrRedirect(caseId);
  const canManage =
    canUpdateCase(user, toCaseUpdateRow(row)) &&
    hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
  if (!canManage) goCase(caseId, "Only CX Ops/Admin can activate this task.", "error");

  await prisma.task.updateMany({
    where: { caseId, type: TaskType.AdditionalInfoRequest },
    data: {
      isRunnable: true,
      activatedAt: new Date(),
      isRequired: true,
    },
  });
  await logActivity(caseId, user.id, "task_activated", "Additional Info Request activated.");
  revalidatePath(casePath(caseId));
  goCase(caseId, "Additional Info task is now active.");
}

export async function upsertExternalReferenceAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = upsertExternalReferenceSchema.safeParse(raw);
  if (!parsed.success) goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid external reference.", "error");
  const payload = parsed.data;
  const { caseId } = payload;
  const { user, row } = await getCaseOrRedirect(caseId);

  const caseCanEdit = canUpdateCase(user, toCaseUpdateRow(row));
  let taskScopedAllowed = false;
  if (payload.taskId) {
    const task = row.tasks.find((t) => t.id === payload.taskId);
    if (!task) goCase(caseId, "Task for reference not found.", "error");
    taskScopedAllowed = canUpdateTask(user, toTaskAccessRow(task), toCaseAccessRow(row));
  }
  if (!caseCanEdit && !taskScopedAllowed) {
    goCase(caseId, "You are not allowed to edit external references.", "error");
  }

  if (payload.existingReferenceId) {
    await prisma.externalReference.update({
      where: { id: payload.existingReferenceId },
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId ?? null,
        taskId: payload.taskId ?? null,
        externalStatus: payload.externalStatus ?? null,
        notes: payload.notes ?? null,
      },
    });
    await logActivity(
      caseId,
      user.id,
      "external_reference_updated",
      `${payload.referenceType} updated${payload.taskId ? " for task" : ""}`
    );
  } else {
    await prisma.externalReference.create({
      data: {
        caseId,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId ?? null,
        taskId: payload.taskId ?? null,
        externalStatus: payload.externalStatus ?? null,
        notes: payload.notes ?? null,
      },
    });
    await logActivity(
      caseId,
      user.id,
      "external_reference_added",
      `${payload.referenceType} linked${payload.taskId ? " to task" : ""}`
    );
  }

  revalidatePath(casePath(caseId));
  goCase(caseId, "External reference saved.");
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = addCommentSchema.safeParse(raw);
  if (!parsed.success) goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid comment.", "error");
  const { caseId, body } = parsed.data;
  const { user } = await getCaseOrRedirect(caseId);
  if (!body.trim()) goCase(caseId, "Invalid comment.", "error");

  await prisma.comment.create({
    data: { caseId, userId: user.id, body: body.trim() },
  });
  await logActivity(caseId, user.id, "comment_added", body.trim().slice(0, 120));
  revalidatePath(casePath(caseId));
  goCase(caseId, "Comment added.");
}

export async function addAttachmentMetadataAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = addAttachmentMetadataSchema.safeParse(raw);
  if (!parsed.success) goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid attachment metadata.", "error");
  const { caseId, fileName, mimeType, sizeBytes } = parsed.data;
  const { user, row } = await getCaseOrRedirect(caseId);

  const canEdit =
    canUpdateCase(user, toCaseUpdateRow(row)) ||
    hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.BU_CONTRIBUTOR, RoleKey.FINANCE_APPROVER, RoleKey.PLATFORM_ADMIN]);
  if (!canEdit) goCase(caseId, "You are not allowed to add attachments.", "error");

  const token = randomBytes(4).toString("hex");
  await prisma.attachment.create({
    data: {
      caseId,
      fileName,
      filePath: `demo://local/${caseId}/${token}/${encodeURIComponent(fileName)}`,
      mimeType: mimeType ?? null,
      sizeBytes: sizeBytes ?? null,
      uploadedById: user.id,
    },
  });
  await logActivity(caseId, user.id, "attachment_added", `${fileName}${mimeType ? ` (${mimeType})` : ""}`);
  revalidatePath(casePath(caseId));
  goCase(caseId, "Attachment metadata added.");
}

export async function updateCaseQuoteBookingAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = caseBookingUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid booking update.", "error");
  }
  const { caseId, quoteBookingStatus, notBookedReason } = parsed.data;
  const { user, row } = await getCaseOrRedirect(caseId);
  if (!canUpdateCase(user, toCaseUpdateRow(row))) {
    goCase(caseId, "You are not allowed to update quote booking on this case.", "error");
  }

  const reasonAllowed =
    quoteBookingStatus === QuoteBookingStatus.NOT_BOOKED ||
    quoteBookingStatus === QuoteBookingStatus.PASSED_OVER;
  const storedReason = reasonAllowed ? notBookedReason?.trim() ?? null : null;

  await prisma.case.update({
    where: { id: caseId },
    data: {
      quoteBookingStatus,
      notBookedReason: storedReason,
    },
  });
  await logActivity(
    caseId,
    user.id,
    "quote_booking_updated",
    `status=${quoteBookingStatus}${storedReason ? ` | ${storedReason.slice(0, 160)}` : ""}`,
  );
  revalidatePath(casePath(caseId));
  revalidatePath("/cases");
  revalidatePath("/");
  goCase(caseId, "Quote booking updated.");
}

export async function updateCaseAssetCostsAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = caseAssetCostsUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid cost update.", "error");
  }
  const { caseId, assetId, buCost, cxCost } = parsed.data;
  const { user, row } = await getCaseOrRedirect(caseId);
  if (!canUpdateCase(user, toCaseUpdateRow(row))) {
    goCase(caseId, "You are not allowed to update platform costs on this case.", "error");
  }

  const asset = await prisma.caseAsset.findFirst({ where: { id: assetId, caseId }, select: { id: true } });
  if (!asset) goCase(caseId, "Platform row not found on this case.", "error");

  const bu = normalizeMoneyInput(buCost);
  const cx = normalizeMoneyInput(cxCost);
  await prisma.caseAsset.update({
    where: { id: assetId },
    data: { buCost: bu, cxCost: cx },
  });
  await logActivity(caseId, user.id, "asset_costs_updated", `asset=${assetId.slice(-8)} bu=${bu} cx=${cx}`);
  revalidatePath(casePath(caseId));
  revalidatePath("/cases");
  revalidatePath("/");
  goCase(caseId, "Platform costs updated.");
}

export async function createSalesforceIbCaseAction(formData: FormData): Promise<void> {
  const raw = parseFormData(formData);
  const fallbackCaseId = raw.caseId ?? "";
  const parsed = createSalesforceIbCaseSchema.safeParse(raw);
  if (!parsed.success) {
    goCase(fallbackCaseId, parsed.error.issues[0]?.message ?? "Invalid request.", "error");
  }
  const { caseId } = parsed.data;
  const { user } = await getCaseOrRedirect(caseId);
  if (!canTriggerSalesforceIbCaseCreation(user)) {
    goCase(caseId, "Only CX Operations or Platform Admin can create a Salesforce IB case.", "error");
  }

  const full = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      tasks: { select: { type: true, status: true } },
      references: true,
      assets: { orderBy: { sortOrder: "asc" }, select: { platformName: true } },
    },
  });
  if (!full) goCase(caseId, "Case not found.", "error");

  const eligibility = evaluateSalesforceIbCreationEligibility({
    status: full.status,
    customerName: full.customerName,
    businessJustification: full.businessJustification,
    assets: full.assets,
    tasks: full.tasks,
    references: full.references,
  });
  if (!eligibility.canAttempt) {
    goCase(caseId, eligibility.blockedReason ?? "Cannot create Salesforce IB case.", "error");
  }

  const latestIbRows = await prisma.externalReference.findMany({
    where: { caseId, referenceType: ExternalReferenceType.SALESFORCE_IB },
    select: { referenceType: true, integrationState: true, referenceId: true },
  });
  if (hasSuccessfulSalesforceIbReference(latestIbRows)) {
    goCase(caseId, "A Salesforce IB case is already linked for this case.", "ok");
  }

  const ibRefs = full.references.filter((r) => r.referenceType === ExternalReferenceType.SALESFORCE_IB);
  const payload = mapEoXCaseToSalesforceIbPayload({
    case: full,
    tasks: full.tasks,
    assets: full.assets,
    salesforceIbReferences: ibRefs,
  });

  const isRetry = payload.priorFailedAttempt;
  await logActivity(
    caseId,
    user.id,
    "salesforce_ib_create_attempt",
    `${isRetry ? "retry" : "initial"} | ${full.caseId}`
  );

  const provider = getSalesforceIbProvider();
  const attemptedAt = new Date();
  const result = await provider.createIbCase(payload);

  const existingIb = await prisma.externalReference.findFirst({
    where: { caseId, referenceType: ExternalReferenceType.SALESFORCE_IB },
    orderBy: { updatedAt: "desc" },
  });

  const integrationMetadata =
    result.rawResponse != null ? (result.rawResponse as Prisma.InputJsonValue) : undefined;

  if (result.ok) {
    const data: Prisma.ExternalReferenceUpdateInput = {
      referenceType: ExternalReferenceType.SALESFORCE_IB,
      referenceId: result.salesforceRecordId,
      externalKey: result.salesforceCaseNumber,
      externalSystemName: SALESFORCE_EXTERNAL_SYSTEM_NAME,
      integrationState: ExternalReferenceIntegrationState.CREATED,
      externalRecordUrl: result.recordUrl,
      externalStatus: "Created",
      lastAttemptAt: attemptedAt,
      lastErrorMessage: null,
      ...(integrationMetadata !== undefined ? { integrationMetadata } : {}),
    };
    if (existingIb) {
      await prisma.externalReference.update({ where: { id: existingIb.id }, data });
    } else {
      await prisma.externalReference.create({
        data: {
          caseId,
          referenceType: ExternalReferenceType.SALESFORCE_IB,
          referenceId: result.salesforceRecordId,
          externalKey: result.salesforceCaseNumber,
          externalSystemName: SALESFORCE_EXTERNAL_SYSTEM_NAME,
          integrationState: ExternalReferenceIntegrationState.CREATED,
          externalRecordUrl: result.recordUrl,
          externalStatus: "Created",
          lastAttemptAt: attemptedAt,
          lastErrorMessage: null,
          notes: null,
          ...(integrationMetadata !== undefined ? { integrationMetadata } : {}),
        },
      });
    }
    await logActivity(
      caseId,
      user.id,
      "salesforce_ib_created",
      `SF Case ${result.salesforceCaseNumber} | ${result.salesforceRecordId}`
    );
    revalidatePath(casePath(caseId));
    revalidatePath("/cases");
    revalidatePath("/");
    goCase(caseId, "Salesforce IB case created (via integration provider).");
  } else {
    const failData: Prisma.ExternalReferenceUpdateInput = {
      referenceId: null,
      externalKey: null,
      externalRecordUrl: null,
      externalSystemName: SALESFORCE_EXTERNAL_SYSTEM_NAME,
      integrationState: ExternalReferenceIntegrationState.FAILED,
      externalStatus: null,
      lastAttemptAt: attemptedAt,
      lastErrorMessage: result.errorMessage,
      ...(integrationMetadata !== undefined ? { integrationMetadata } : {}),
    };
    if (existingIb) {
      await prisma.externalReference.update({ where: { id: existingIb.id }, data: failData });
    } else {
      await prisma.externalReference.create({
        data: {
          caseId,
          referenceType: ExternalReferenceType.SALESFORCE_IB,
          referenceId: null,
          externalKey: null,
          externalRecordUrl: null,
          externalSystemName: SALESFORCE_EXTERNAL_SYSTEM_NAME,
          integrationState: ExternalReferenceIntegrationState.FAILED,
          externalStatus: null,
          lastAttemptAt: attemptedAt,
          lastErrorMessage: result.errorMessage,
          notes: null,
          ...(integrationMetadata !== undefined ? { integrationMetadata } : {}),
        },
      });
    }
    await logActivity(
      caseId,
      user.id,
      "salesforce_ib_create_failed",
      `${result.errorCode}: ${result.errorMessage.slice(0, 240)}`
    );
    revalidatePath(casePath(caseId));
    revalidatePath("/cases");
    revalidatePath("/");
    goCase(caseId, result.errorMessage, "error");
  }
}

