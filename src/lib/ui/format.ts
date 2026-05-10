import type {
  CaseStatus,
  EssMssSupportSubtype,
  QuoteBookingStatus,
  RequestType,
  TaskStatus,
  TaskType,
} from "@prisma/client";

const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  InReview: "In review",
  AwaitingInfo: "Awaiting info",
  InProgress: "In progress",
  Blocked: "Blocked",
  ReadyForRelease: "Ready for release",
  Closed: "Closed",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
};

const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  EoVSS: "EoVSS",
  EoSM: "EoSM",
  ESS_MSS: "ESS/MSS",
};

/** Short intake copy; EoSM = End of Software Maintenance (see docs/PROJECT_CONTEXT.md). */
export const REQUEST_TYPE_INTAKE_HINT: Record<RequestType, string> = {
  EoVSS:
    "Version / software support — serial numbers per platform are required when you submit. Partner name is optional; quantity (if any) is per platform line.",
  EoSM:
    "End of Software Maintenance (EoSM) — end of regular software maintenance and routine bug fixes for the product in scope; security fixes may continue per EoVS/EoVSS policy (product-dependent). Partner name is optional; quantity (if any) is per platform line.",
  ESS_MSS:
    "ESS/MSS — extended support (ESS) scope with room for future MSS workflow; hardware and/or qualified on‑prem perpetual application software. Migration plan required on submit; partner optional; quantity per platform line if needed.",
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NotStarted: "Not started",
  InProgress: "In progress",
  Completed: "Completed",
  Blocked: "Blocked",
  NotRequired: "Not required",
};

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  IntakeValidation: "Intake validation",
  EligibilityReview: "Eligibility review",
  BUReview: "BU review",
  BUPricing: "BU pricing",
  QuoteTracking: "Quote tracking",
  VAPTracking: "VAP tracking",
  FlagRemovalTracking: "Flag removal tracking",
  AdditionalInfoRequest: "Additional info request",
};

export function formatCaseStatus(s: CaseStatus): string {
  return CASE_STATUS_LABEL[s] ?? s;
}

export function formatRequestType(t: RequestType): string {
  return REQUEST_TYPE_LABEL[t] ?? t;
}

const ESS_MSS_SUBTYPE_LABEL: Record<EssMssSupportSubtype, string> = {
  HARDWARE: "Hardware",
  SOFTWARE: "Software",
  HARDWARE_AND_SOFTWARE: "Hardware + Software",
};

export function formatEssMssSupportSubtype(s: EssMssSupportSubtype | null | undefined): string {
  if (!s) return "—";
  return ESS_MSS_SUBTYPE_LABEL[s] ?? s;
}

export function formatTaskStatus(s: TaskStatus): string {
  return TASK_STATUS_LABEL[s] ?? s;
}

export function formatTaskType(t: TaskType): string {
  return TASK_TYPE_LABEL[t] ?? t;
}

const QUOTE_BOOKING_LABEL: Record<QuoteBookingStatus, string> = {
  OPEN: "Open",
  BOOKED: "Booked",
  NOT_BOOKED: "Not booked",
  PASSED_OVER: "Passed over",
};

export function formatQuoteBookingStatus(s: QuoteBookingStatus): string {
  return QUOTE_BOOKING_LABEL[s] ?? s;
}

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Demo USD formatting (two decimal places). */
export function formatUsd2(amount: number): string {
  return usd2.format(Number.isFinite(amount) ? amount : 0);
}

/** Human-readable activity `action` codes for the case activity log. */
const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  case_created: "created the case",
  case_submitted: "submitted the case",
  case_status_changed: "changed case status",
  case_assignment_updated: "updated case assignment",
  task_created: "created a task",
  task_updated: "updated a task",
  task_activated: "activated a task",
  comment_added: "added a comment",
  attachment_added: "added an attachment",
  external_reference_added: "added an external reference",
  external_reference_updated: "updated an external reference",
  quote_booking_updated: "updated quote booking",
  asset_costs_updated: "updated platform costs",
  status_observed: "recorded status",
  draft_saved: "saved a draft",
  draft_created: "created a draft",
  salesforce_ib_create_attempt: "attempted Salesforce IB case create",
  salesforce_ib_created: "created a Salesforce IB case",
  salesforce_ib_create_failed: "Salesforce IB create failed",
};

export function formatActivityAction(action: string): string {
  return ACTIVITY_ACTION_LABEL[action] ?? action.replace(/_/g, " ");
}
