import { EssMssSupportSubtype, Priority, RequestType } from "@prisma/client";
import { z } from "zod";
import { normalizeMoneyInput } from "@/lib/cases/financials";

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
}, z.number().int().nonnegative().optional());

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

const moneyFromForm = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return 0;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return 0;
  return n;
}, z.number().min(0).max(999_999_999.99)).transform((n) => normalizeMoneyInput(n));

/**
 * One platform / asset line item (persisted as CaseAsset).
 * `platformName` may be empty in the UI while drafting; submit enforces a non-empty name per row.
 */
export const caseAssetRowSchema = z.object({
  platformName: z.string().max(200),
  serialNumbers: z.string().max(12000).optional().transform((s) => (s?.trim() ? s : undefined)),
  eolBulletinLink: optionalUrl,
  hwLdosDate: optionalDateInput,
  softwareVersion: z.string().max(120).optional().transform((s) => (s?.trim() ? s : undefined)),
  quantity: quantityFromForm,
  buCost: moneyFromForm,
  cxCost: moneyFromForm,
});

export type CaseAssetRowInput = z.infer<typeof caseAssetRowSchema>;

const boolFromForm = z.preprocess((val) => {
  if (val === true || val === "true" || val === "on" || val === 1 || val === "1") return true;
  if (val === false || val === "false" || val === 0 || val === "0") return false;
  return undefined;
}, z.boolean().optional());

const essMssIntakeFields = {
  essSupportSubtype: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.nativeEnum(EssMssSupportSubtype).optional(),
  ),
  migrationTimeline: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  targetReplacementProduct: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  hardwarePhysicalLocation: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  softwareDeploymentType: z
    .string()
    .max(200)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  softwareProductFamily: z
    .string()
    .max(200)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  softwareOnPremise: boolFromForm,
  softwarePerpetualLicense: boolFromForm,
  softwareIsApplicationSoftware: boolFromForm,
  softwareNotIosIosXr: boolFromForm,
  environmentIsProduction: boolFromForm,
  essEligibilityAcknowledged: z.boolean().optional().default(false),
};

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
  ...essMssIntakeFields,
  partnerName: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  supportCoverageIndicator: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  notes: z.string().max(12000).optional().transform((s) => (s?.trim() ? s : undefined)),
  attachments: z.array(intakeAttachmentSchema).max(24).optional().default([]),
  /** Multi-platform / asset rows; drafts may be empty until the user adds lines. */
  assets: z.array(caseAssetRowSchema).max(48).optional().default([]),
};

/**
 * Draft save: permissive — enums and max lengths only.
 */
export const draftCaseSchema = z.object({
  ...intakeMetaFields,
  customerName: z.string().max(200).default(""),
  dealId: z.string().max(120).default(""),
  businessJustification: z.string().max(8000).default(""),
});

export type DraftCaseInput = z.infer<typeof draftCaseSchema>;

/**
 * Submit: strict core fields + request-type rules. Deal ID optional. At least one asset row.
 */
export const submitCaseSchema = z
  .object({
    ...intakeMetaFields,
    customerName: z.string().min(1, "Customer name is required.").max(200),
    dealId: z.string().max(120).optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
    assets: z.array(caseAssetRowSchema).min(1, "Add at least one platform / asset."),
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

    data.assets.forEach((row, idx) => {
      if (!row.platformName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["assets", idx, "platformName"],
          message: "Enter a platform name for each row, or remove empty rows.",
        });
      }
    });

    if (data.requestType === RequestType.EoVSS) {
      data.assets.forEach((row, idx) => {
        const s = row.serialNumbers?.trim() ?? "";
        if (s.length < 1) {
          ctx.addIssue({
            code: "custom",
            path: ["assets", idx, "serialNumbers"],
            message: "EoVSS requires serial numbers (or asset identifiers) on each platform row.",
          });
        }
      });
    }

    if (data.requestType === RequestType.ESS_MSS) {
      if (!data.essSupportSubtype) {
        ctx.addIssue({
          code: "custom",
          path: ["essSupportSubtype"],
          message: "Select an ESS/MSS support subtype (hardware, software, or both).",
        });
      }
      const mp = data.migrationPlan?.trim() ?? "";
      if (mp.length < 40) {
        ctx.addIssue({
          code: "custom",
          path: ["migrationPlan"],
          message: "ESS/MSS requires a migration plan summary (at least 40 characters).",
        });
      }

      const st = data.essSupportSubtype;
      const hw =
        st === EssMssSupportSubtype.HARDWARE || st === EssMssSupportSubtype.HARDWARE_AND_SOFTWARE;
      const sw =
        st === EssMssSupportSubtype.SOFTWARE || st === EssMssSupportSubtype.HARDWARE_AND_SOFTWARE;

      if (hw) {
        const loc = data.hardwarePhysicalLocation?.trim() ?? "";
        if (loc.length < 5) {
          ctx.addIssue({
            code: "custom",
            path: ["hardwarePhysicalLocation"],
            message: "Hardware scope requires a physical location (assessed site) of at least 5 characters.",
          });
        }
        const anySerial = data.assets.some((a) => (a.serialNumbers?.trim() ?? "").length > 0);
        if (!anySerial) {
          ctx.addIssue({
            code: "custom",
            path: ["assets", 0, "serialNumbers"],
            message: "Hardware ESS/MSS: enter serial numbers on at least one platform row.",
          });
        }
      }

      if (sw) {
        if (!(data.softwareDeploymentType?.trim())) {
          ctx.addIssue({
            code: "custom",
            path: ["softwareDeploymentType"],
            message: "Software scope requires a deployment type.",
          });
        }
        if (!(data.softwareProductFamily?.trim())) {
          ctx.addIssue({
            code: "custom",
            path: ["softwareProductFamily"],
            message: "Software scope requires a product family / application type.",
          });
        }
        if (data.environmentIsProduction === undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["environmentIsProduction"],
            message: "Select whether this is a production environment or lab/non-production.",
          });
        }
        const softRuleBreak =
          data.softwareOnPremise !== true ||
          data.softwarePerpetualLicense !== true ||
          data.softwareIsApplicationSoftware !== true ||
          data.softwareNotIosIosXr !== true;
        const nonProd = data.environmentIsProduction === false;
        if ((softRuleBreak || nonProd) && !data.essEligibilityAcknowledged) {
          ctx.addIssue({
            code: "custom",
            path: ["essEligibilityAcknowledged"],
            message:
              "Confirm eligibility review when software declarations are not all aligned, or when the environment is lab/non-production.",
          });
        }
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
  extensionStartDate: undefined,
  extensionEndDate: undefined,
  businessJustification: "",
  migrationPlan: undefined,
  essSupportSubtype: undefined,
  migrationTimeline: undefined,
  targetReplacementProduct: undefined,
  hardwarePhysicalLocation: undefined,
  softwareDeploymentType: undefined,
  softwareProductFamily: undefined,
  softwareOnPremise: true,
  softwarePerpetualLicense: true,
  softwareIsApplicationSoftware: true,
  softwareNotIosIosXr: true,
  environmentIsProduction: undefined,
  essEligibilityAcknowledged: false,
  partnerName: undefined,
  supportCoverageIndicator: undefined,
  notes: undefined,
  attachments: [],
  assets: [
    {
      platformName: "",
      serialNumbers: undefined,
      eolBulletinLink: undefined,
      hwLdosDate: undefined,
      softwareVersion: undefined,
      quantity: undefined,
      buCost: 0,
      cxCost: 0,
    },
  ],
};
