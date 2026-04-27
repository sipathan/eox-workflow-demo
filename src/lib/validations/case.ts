import { Priority, RequestType } from "@prisma/client";
import { z } from "zod";

/** Client-selected files represented as metadata only (no binary upload in this demo). */
export const intakeAttachmentSchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().max(500_000_000).optional(),
});

export type IntakeAttachmentInput = z.infer<typeof intakeAttachmentSchema>;

const quantityFromForm = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : undefined;
}, z.number().int().positive().optional());

const optionalUrl = z
  .string()
  .max(2000)
  .optional()
  .transform((s) => (s ?? "").trim())
  .transform((t) => (t.length === 0 ? undefined : t))
  .refine((s) => {
    if (s === undefined) return true;
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, {
    message: "Enter a valid http(s) URL or leave blank.",
  });

const optionalDateInput = z
  .string()
  .optional()
  .transform((s) => {
    const t = s?.trim() ?? "";
    return t.length === 0 ? undefined : t;
  });

const draftCaseInternalIdField = z
  .string()
  .optional()
  .transform((s) => (s?.trim() ? s.trim() : undefined));

const intakeMetaFields = {
  draftCaseInternalId: draftCaseInternalIdField,
  requestType: z.nativeEnum(RequestType),
  priority: z.nativeEnum(Priority),
  extensionStartDate: optionalDateInput,
  extensionEndDate: optionalDateInput,
  migrationPlan: z
    .string()
    .max(8000)
    .optional()
    .transform((s) => (s?.trim() ? s : undefined)),
  partnerName: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  quantity: quantityFromForm,
  eolBulletinLink: optionalUrl,
  serialNumbers: z.string().max(12000).optional().transform((s) => (s?.trim() ? s : undefined)),
  supportCoverageIndicator: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  hwLdosDate: optionalDateInput,
  notes: z.string().max(12000).optional().transform((s) => (s?.trim() ? s : undefined)),
  attachments: z.array(intakeAttachmentSchema).max(24).optional().default([]),
};

/**
 * Draft save: permissive — enums and max lengths only. Empty strings allowed; server maps to DB placeholders.
 */
export const draftCaseSchema = z.object({
  ...intakeMetaFields,
  customerName: z.string().max(200).default(""),
  dealId: z.string().max(120).default(""),
  platform: z.string().max(200).default(""),
  softwareVersion: z.string().max(120).default(""),
  businessJustification: z.string().max(8000).default(""),
});

export type DraftCaseInput = z.infer<typeof draftCaseSchema>;

/**
 * Submit: strict core fields + `superRefine` for request-type-specific rules and date ordering.
 */
export const submitCaseSchema = z
  .object({
    ...intakeMetaFields,
    customerName: z.string().min(1, "Customer name is required.").max(200),
    dealId: z.string().min(1, "Deal ID is required.").max(120),
    platform: z.string().min(1, "Platform is required.").max(200),
    softwareVersion: z.string().min(1, "Software version is required.").max(120),
    businessJustification: z
      .string()
      .min(10, "Business justification must be at least 10 characters.")
      .max(8000),
  })
  .superRefine((data, ctx) => {
    const start = data.extensionStartDate ? new Date(data.extensionStartDate) : null;
    const end = data.extensionEndDate ? new Date(data.extensionEndDate) : null;
    if (start && Number.isNaN(start.getTime())) {
      ctx.addIssue({ code: "custom", path: ["extensionStartDate"], message: "Invalid start date." });
    }
    if (end && Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: "custom", path: ["extensionEndDate"], message: "Invalid end date." });
    }
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      ctx.addIssue({
        code: "custom",
        path: ["extensionEndDate"],
        message: "Extension end must be on or after the start date.",
      });
    }

    if (data.requestType === RequestType.EoSM) {
      const m = data.migrationPlan?.trim() ?? "";
      if (m.length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["migrationPlan"],
          message: "EoSM requires a migration plan (at least 10 characters).",
        });
      }
    }

    if (data.requestType === RequestType.EoSS) {
      if (!data.partnerName?.trim()) {
        ctx.addIssue({ code: "custom", path: ["partnerName"], message: "EoSS requires a partner name." });
      }
      if (data.quantity === undefined || data.quantity < 1) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: "EoSS requires a positive quantity." });
      }
    }

    if (data.requestType === RequestType.EoVSS) {
      const s = data.serialNumbers?.trim() ?? "";
      if (s.length < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["serialNumbers"],
          message: "EoVSS requires serial numbers or an asset identifier list.",
        });
      }
    }
  });

export type SubmitCaseInput = z.infer<typeof submitCaseSchema>;

export type CaseFormValues = Omit<SubmitCaseInput, "attachments"> & {
  attachments: IntakeAttachmentInput[];
  draftCaseInternalId?: string;
};

export const caseIntakeDefaultValues: CaseFormValues = {
  draftCaseInternalId: undefined,
  requestType: RequestType.EoVSS,
  priority: Priority.Medium,
  customerName: "",
  dealId: "",
  platform: "",
  softwareVersion: "",
  extensionStartDate: undefined,
  extensionEndDate: undefined,
  businessJustification: "",
  migrationPlan: undefined,
  partnerName: undefined,
  quantity: undefined,
  eolBulletinLink: undefined,
  serialNumbers: undefined,
  supportCoverageIndicator: undefined,
  hwLdosDate: undefined,
  notes: undefined,
  attachments: [],
};
