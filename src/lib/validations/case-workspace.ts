import { CaseStatus, ExternalReferenceType, TaskStatus, TaskType } from "@prisma/client";
import { z } from "zod";

export const caseStatusUpdateSchema = z.object({
  caseId: z.string().min(1),
  toStatus: z.nativeEnum(CaseStatus),
  reason: z.string().max(2000).optional().transform((s) => s?.trim() || undefined),
});

export const caseAssignmentUpdateSchema = z.object({
  caseId: z.string().min(1),
  ownerId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  assignedTeamId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  reason: z.string().max(1000).optional().transform((s) => s?.trim() || undefined),
});

export const addCommentSchema = z.object({
  caseId: z.string().min(1),
  body: z.string().min(1, "Comment is required.").max(4000),
});

export const addAttachmentMetadataSchema = z.object({
  caseId: z.string().min(1),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  sizeBytes: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().nonnegative().max(500_000_000).optional()),
});

export const createTaskSchema = z.object({
  caseId: z.string().min(1),
  type: z.nativeEnum(TaskType),
  ownerId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  assignedTeamId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  dueDate: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  notes: z.string().max(4000).optional().transform((s) => s?.trim() || undefined),
});

export const updateTaskSchema = z.object({
  caseId: z.string().min(1),
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
  ownerId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  assignedTeamId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  dueDate: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  isRequired: z.preprocess((v) => v === "true" || v === true, z.boolean()),
  notes: z.string().max(4000).optional().transform((s) => s?.trim() || undefined),
  blockerReason: z.string().max(2000).optional().transform((s) => s?.trim() || undefined),
  notRequiredReason: z.string().max(2000).optional().transform((s) => s?.trim() || undefined),
});

export const upsertExternalReferenceSchema = z.object({
  caseId: z.string().min(1),
  referenceId: z.string().min(1).max(400),
  referenceType: z.nativeEnum(ExternalReferenceType),
  externalStatus: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  notes: z.string().max(2000).optional().transform((s) => s?.trim() || undefined),
  taskId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  existingReferenceId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
});
