import type { Prisma } from "@prisma/client";
import {
  EssMssSupportSubtype,
  RequestType,
  TaskStatus,
  TaskType,
} from "@prisma/client";

/** Shown on new `EligibilityReview` tasks so work items and case detail stay readable. */
export const ESS_MSS_ELIGIBILITY_NOTE_HARDWARE =
  "ESS/MSS · Hardware — review serials, physical location, and platform lines against intake.";

export const ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE =
  "ESS/MSS · Software — review deployment type, product family, declarations, and environment.";

export const ESS_MSS_ELIGIBILITY_NOTE_FALLBACK =
  "ESS/MSS · Eligibility — review intake and subtype when scope was not fully classified.";

export type SubmittedCaseTaskTemplateInput = {
  caseId: string;
  assetIds: string[];
  cxOpsTeamId: string | null;
  buQueueId: string | null;
  now: Date;
  requestType: RequestType;
  /** Used only when `requestType === ESS_MSS`; may be null before validation fixes draft edge cases. */
  essSupportSubtype: EssMssSupportSubtype | null;
};

function eligibilityNotesForEssSubtype(subtype: EssMssSupportSubtype | null): string[] {
  switch (subtype) {
    case EssMssSupportSubtype.HARDWARE:
      return [ESS_MSS_ELIGIBILITY_NOTE_HARDWARE];
    case EssMssSupportSubtype.SOFTWARE:
      return [ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE];
    case EssMssSupportSubtype.HARDWARE_AND_SOFTWARE:
      return [ESS_MSS_ELIGIBILITY_NOTE_HARDWARE, ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE];
    default:
      return [ESS_MSS_ELIGIBILITY_NOTE_FALLBACK];
  }
}

/**
 * Default tasks for a newly submitted case. EoVSS/EoSM keep the BU review/pricing ladder per asset;
 * ESS/MSS uses intake → one or two eligibility rows (by subtype) → quote / VAP / flag / optional info.
 * Future MSS-only steps can branch inside `requestType === ESS_MSS` without changing EoVSS/EoSM paths.
 */
export function buildSubmittedCaseTaskRows(input: SubmittedCaseTaskTemplateInput): Prisma.TaskCreateManyInput[] {
  const { caseId, assetIds, cxOpsTeamId, buQueueId, now, requestType, essSupportSubtype } = input;
  const rows: Prisma.TaskCreateManyInput[] = [];

  rows.push({
    caseId,
    caseAssetId: null,
    type: TaskType.IntakeValidation,
    status: TaskStatus.NotStarted,
    isRunnable: true,
    activatedAt: now,
    isRequired: true,
    assignedTeamId: cxOpsTeamId,
  });

  if (requestType === RequestType.ESS_MSS) {
    for (const note of eligibilityNotesForEssSubtype(essSupportSubtype)) {
      rows.push({
        caseId,
        caseAssetId: null,
        type: TaskType.EligibilityReview,
        status: TaskStatus.NotStarted,
        isRunnable: false,
        activatedAt: null,
        isRequired: true,
        assignedTeamId: cxOpsTeamId,
        notes: note,
      });
    }
  } else {
    for (const aid of assetIds) {
      rows.push({
        caseId,
        caseAssetId: aid,
        type: TaskType.BUReview,
        status: TaskStatus.NotStarted,
        isRunnable: false,
        activatedAt: null,
        isRequired: true,
        assignedTeamId: buQueueId,
      });
      rows.push({
        caseId,
        caseAssetId: aid,
        type: TaskType.BUPricing,
        status: TaskStatus.NotStarted,
        isRunnable: false,
        activatedAt: null,
        isRequired: true,
        assignedTeamId: buQueueId,
      });
    }
  }

  for (const tp of [TaskType.QuoteTracking, TaskType.VAPTracking, TaskType.FlagRemovalTracking] as const) {
    rows.push({
      caseId,
      caseAssetId: null,
      type: tp,
      status: TaskStatus.NotStarted,
      isRunnable: false,
      activatedAt: null,
      isRequired: true,
      assignedTeamId: cxOpsTeamId,
    });
  }

  rows.push({
    caseId,
    caseAssetId: null,
    type: TaskType.AdditionalInfoRequest,
    status: TaskStatus.NotStarted,
    isRunnable: false,
    activatedAt: null,
    isRequired: false,
    assignedTeamId: cxOpsTeamId,
  });

  return rows;
}
