import {
  CaseStatus,
  ExternalReferenceType,
  QuoteBookingStatus,
  TaskStatus,
  TaskType,
} from "@prisma/client";
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
  dealId: z
    .string()
    .max(120)
    .optional()
    .transform((s) => {
      if (s === undefined) return undefined;
      const t = s.trim();
      return t.length === 0 ? null : t;
    }),
  routingNote: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => {
      if (s === undefined) return undefined;
      const t = s.trim();
      return t.length === 0 ? null : t;
    }),
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
  assignedTeamId: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  dueDate: z.string().optional().transform((s) => (s?.trim() ? s : undefined)),
  notes: z.string().max(4000).optional().transform((s) => s?.trim() || undefined),
});

export const updateTaskSchema = z.object({
  caseId: z.string().min(1),
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
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

export const caseBookingUpdateSchema = z
  .object({
    caseId: z.string().min(1),
    quoteBookingStatus: z.nativeEnum(QuoteBookingStatus),
    notBookedReason: z
      .string()
      .max(2000)
      .optional()
      .transform((s) => (s?.trim() ? s.trim() : undefined)),
  })
  .superRefine((data, ctx) => {
    const needsReason =
      data.quoteBookingStatus === QuoteBookingStatus.NOT_BOOKED ||
      data.quoteBookingStatus === QuoteBookingStatus.PASSED_OVER;
    if (needsReason && !data.notBookedReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["notBookedReason"],
        message: "A reason is required when booking status is Not booked or Passed over.",
      });
    }
  });

export const caseAssetCostsUpdateSchema = z.object({
  caseId: z.string().min(1),
  assetId: z.string().min(1),
  buCost: z.coerce.number().min(0).max(999_999_999.99),
  cxCost: z.coerce.number().min(0).max(999_999_999.99),
});
