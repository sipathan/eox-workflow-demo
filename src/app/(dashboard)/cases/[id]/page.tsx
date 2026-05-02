import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CaseStatus,
  EssMssSupportSubtype,
  ExternalReferenceType,
  QuoteBookingStatus,
  RequestType,
  RoleKey,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getCaseByIdForUser } from "@/lib/cases/queries";
import {
  activateAdditionalInfoTaskAction,
  addAttachmentMetadataAction,
  addCommentAction,
  createTaskAction,
  updateCaseAssignmentAction,
  updateCaseStatusAction,
  updateTaskAction,
  upsertExternalReferenceAction,
} from "@/app/actions/case-workspace";
import { BookingOutcomeForm } from "@/components/case/BookingOutcomeForm";
import { PlatformAssetCostEditor } from "@/components/case/PlatformAssetCostEditor";
import { TaskRowForm } from "@/components/case/TaskRowForm";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  canActOnUnownedTeamTask,
  canUpdateCase,
  canUpdateTask,
  hasAnyRole,
  isReadOnlyDemoUser,
  type CaseAccessRow,
  type TaskAccessRow,
} from "@/lib/rbac";
import { rollupCaseFinancials, totalQuantityFromAssets } from "@/lib/cases/financials";
import {
  formatCaseStatus,
  formatEssMssSupportSubtype,
  formatQuoteBookingStatus,
  formatRequestType,
  formatTaskStatus,
  formatTaskType,
  formatUsd2,
} from "@/lib/ui/format";
import { daysActiveDisplay, sortCaseTasksForDisplay, taskWorkItemLabel } from "@/lib/workflow/task-display";
import {
  assignedTeamFallbackLabelForCase,
  ownershipDisplayForCase,
  ownershipDisplayForTask,
} from "@/lib/workflow/assignment-display";

function parseFlash(
  searchParams: { flash?: string; tone?: string } | undefined
): { message: string; tone: "ok" | "error" } | null {
  if (!searchParams?.flash) return null;
  const tone = searchParams.tone === "error" ? "error" : "ok";
  return { message: searchParams.flash, tone };
}

const CASE_STATUSES: CaseStatus[] = [
  CaseStatus.Draft,
  CaseStatus.Submitted,
  CaseStatus.InReview,
  CaseStatus.AwaitingInfo,
  CaseStatus.InProgress,
  CaseStatus.Blocked,
  CaseStatus.ReadyForRelease,
  CaseStatus.Closed,
  CaseStatus.Rejected,
  CaseStatus.Cancelled,
];

const TASK_STATUSES: TaskStatus[] = [
  TaskStatus.NotStarted,
  TaskStatus.InProgress,
  TaskStatus.Completed,
  TaskStatus.Blocked,
  TaskStatus.NotRequired,
];

const TASK_TYPES: TaskType[] = [
  TaskType.IntakeValidation,
  TaskType.EligibilityReview,
  TaskType.BUReview,
  TaskType.BUPricing,
  TaskType.QuoteTracking,
  TaskType.VAPTracking,
  TaskType.FlagRemovalTracking,
  TaskType.AdditionalInfoRequest,
];

const EXTERNAL_REFERENCE_TYPES: ExternalReferenceType[] = [
  ExternalReferenceType.QUOTE_ID,
  ExternalReferenceType.VAP_ID,
  ExternalReferenceType.APAS_NPI,
];

function quoteBookingNeedsReason(status: QuoteBookingStatus): boolean {
  return status === QuoteBookingStatus.NOT_BOOKED || status === QuoteBookingStatus.PASSED_OVER;
}

/** Booking/commercial line is considered finalized for summary UX when outcome is set or case is terminal. */
function isBookingCommercialFinalized(caseStatus: CaseStatus, quoteBookingStatus: QuoteBookingStatus): boolean {
  if (
    caseStatus === CaseStatus.Closed ||
    caseStatus === CaseStatus.Rejected ||
    caseStatus === CaseStatus.Cancelled
  ) {
    return true;
  }
  return quoteBookingStatus !== QuoteBookingStatus.OPEN;
}

function toCaseAccessRow(c: {
  requesterId: string;
  ownerId: string | null;
  assignedTeamId: string | null;
  tasks: { ownerId: string | null; assignedTeamId: string | null }[];
}): CaseAccessRow {
  return {
    requesterId: c.requesterId,
    ownerId: c.ownerId,
    assignedTeamId: c.assignedTeamId,
    taskOwnerIds: c.tasks.map((t) => t.ownerId).filter(Boolean) as string[],
    taskTeamIds: c.tasks.map((t) => t.assignedTeamId).filter(Boolean) as string[],
  };
}

export default async function CaseDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string; tone?: string }>;
}) {
  const { id } = await props.params;
  const flash = parseFlash(await props.searchParams);
  const user = await getSessionUser();
  if (!user) redirect("/");

  const c = await getCaseByIdForUser(user, id);
  if (!c) notFound();
  const sortedTasks = sortCaseTasksForDisplay(c.tasks);
  const readonly = isReadOnlyDemoUser(user);
  const caseAccess = toCaseAccessRow(c);
  /** CX/Platform: case status, queue/Deal ID/routing note, task assignment pickers, Add task (matches server gates). */
  const canManageCaseOps =
    !readonly &&
    canUpdateCase(user, { ...caseAccess, status: c.status }) &&
    hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
  const dealIdTrimmed = (c.dealId ?? "").trim();
  const canEditCaseFinancials = !readonly && canUpdateCase(user, { ...caseAccess, status: c.status });
  const financialRollup = rollupCaseFinancials(
    c.assets.map((a) => ({ buCost: a.buCost, cxCost: a.cxCost }))
  );
  const totalUnitsQty = totalQuantityFromAssets(c.assets);
  const canAddComment = !readonly;
  const canAddAttachment = !readonly;
  const canEditReferences = !readonly;

  const [users, teams] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/cases" className="text-sky-700 hover:underline">
            Cases
          </Link>
          <span className="mx-1">/</span>
          <span>{c.caseId}</span>
        </p>
        <PageHeader
          title={c.caseId}
          description={`Requester: ${c.requester.name} · Owner: ${ownershipDisplayForCase(c)} · Team: ${assignedTeamFallbackLabelForCase(c)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} />
              <PriorityBadge priority={c.priority} />
              <Badge tone="neutral">{formatRequestType(c.requestType)}</Badge>
            </div>
          }
        />
      </div>

      {flash ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            flash.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {flash.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Case summary</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Case ID</dt>
            <dd className="font-mono text-slate-900">{c.caseId}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Service</dt>
            <dd className="text-slate-900">{formatRequestType(c.requestType)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Customer</dt>
            <dd className="text-slate-900">{c.customerName}</dd>
          </div>
          {dealIdTrimmed ? (
            <div>
              <dt className="text-xs uppercase text-slate-500">Deal ID</dt>
              <dd className="font-mono text-slate-900">{dealIdTrimmed}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase text-slate-500">Priority</dt>
            <dd>
              <PriorityBadge priority={c.priority} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Requester</dt>
            <dd className="text-slate-900">{c.requester.name}</dd>
          </div>
        </dl>

        <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business justification</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{c.businessJustification}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Migration plan</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {c.migrationPlan?.trim() ? c.migrationPlan : "—"}
            </p>
            {c.requestType === RequestType.ESS_MSS ? (
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                Required narrative for ESS/MSS on submit; optional supporting text for other services (same field).
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extension window</p>
            <p className="mt-1 text-sm text-slate-900">
              {c.extensionStartDate && c.extensionEndDate
                ? `${c.extensionStartDate.toLocaleDateString()} → ${c.extensionEndDate.toLocaleDateString()}`
                : "—"}
            </p>
          </div>

          {c.requestType === RequestType.ESS_MSS ? (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/35 p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-emerald-100 pb-2">
                <h3 className="text-sm font-semibold text-emerald-950">ESS/MSS</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200">
                  {formatEssMssSupportSubtype(c.essSupportSubtype)}
                </span>
              </div>

              {(c.migrationTimeline?.trim() || c.targetReplacementProduct?.trim()) && (
                <section className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm">
                  {c.migrationTimeline?.trim() ? (
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Timeline</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{c.migrationTimeline}</p>
                    </div>
                  ) : null}
                  {c.targetReplacementProduct?.trim() ? (
                    <div className={c.migrationTimeline?.trim() ? "mt-3 border-t border-slate-100 pt-3" : ""}>
                      <p className="text-xs font-semibold uppercase text-slate-500">Target replacement</p>
                      <p className="mt-1 text-sm text-slate-800">{c.targetReplacementProduct}</p>
                    </div>
                  ) : null}
                </section>
              )}

              {(c.essSupportSubtype === EssMssSupportSubtype.HARDWARE ||
                c.essSupportSubtype === EssMssSupportSubtype.HARDWARE_AND_SOFTWARE) && (
                <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Hardware location</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                    {c.hardwarePhysicalLocation?.trim() ? c.hardwarePhysicalLocation : "—"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Serial numbers and platforms are listed under <strong className="text-slate-700">Platforms &amp; equipment</strong>.
                  </p>
                </section>
              )}

              {(c.essSupportSubtype === EssMssSupportSubtype.SOFTWARE ||
                c.essSupportSubtype === EssMssSupportSubtype.HARDWARE_AND_SOFTWARE) && (
                <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Software &amp; deployment</h4>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase text-slate-500">Deployment type</dt>
                      <dd className="text-slate-800">{c.softwareDeploymentType?.trim() || "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase text-slate-500">Product family / type</dt>
                      <dd className="text-slate-800">{c.softwareProductFamily?.trim() || "—"}</dd>
                    </div>
                  </dl>
                  <div className="rounded-md border border-slate-100 bg-slate-50/90 px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-slate-800">Eligibility signals: </span>
                    On‑prem {c.softwareOnPremise === true ? "yes" : c.softwareOnPremise === false ? "no" : "—"} ·
                    Perpetual {c.softwarePerpetualLicense === true ? "yes" : c.softwarePerpetualLicense === false ? "no" : "—"} ·
                    Application software{" "}
                    {c.softwareIsApplicationSoftware === true ? "yes" : c.softwareIsApplicationSoftware === false ? "no" : "—"} ·
                    Not IOS/IOS‑XR {c.softwareNotIosIosXr === true ? "yes" : c.softwareNotIosIosXr === false ? "no" : "—"} ·
                    Environment{" "}
                    {c.environmentIsProduction === true
                      ? "production"
                      : c.environmentIsProduction === false
                        ? "lab / non‑production"
                        : "—"}
                  </div>
                  {(c.environmentIsProduction === false ||
                    c.softwareOnPremise === false ||
                    c.softwarePerpetualLicense === false ||
                    c.softwareIsApplicationSoftware === false ||
                    c.softwareNotIosIosXr === false) && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      Review suggested: non‑production or declaration mismatch. Intake acknowledgement:{" "}
                      <strong>{c.essEligibilityAcknowledged ? "Yes" : "No"}</strong>.
                    </div>
                  )}
                </section>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Case totals</h3>
              {isBookingCommercialFinalized(c.status, c.quoteBookingStatus) ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                  Booking: {formatQuoteBookingStatus(c.quoteBookingStatus)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950">
                  Booking not updated
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-slate-500">
              Rolled up from all platform lines (same math as <strong className="text-slate-700">Platform financials</strong>{" "}
              below). Per-platform BU/CX are edited there.
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-white/90 bg-white px-2.5 py-2 shadow-sm">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Total BU cost</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                  {formatUsd2(financialRollup.totalBuCost)}
                </dd>
              </div>
              <div className="rounded-md border border-white/90 bg-white px-2.5 py-2 shadow-sm">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Total CX cost</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                  {formatUsd2(financialRollup.totalCxCost)}
                </dd>
              </div>
              <div className="rounded-md border border-emerald-200/60 bg-emerald-50/50 px-2.5 py-2 shadow-sm sm:col-span-1">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-emerald-900/80">Total quote value</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-950">
                  {formatUsd2(financialRollup.totalQuoteValue)}
                </dd>
              </div>
              <div className="rounded-md border border-slate-200/80 bg-white px-2.5 py-2 shadow-sm sm:col-span-3">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Total units (qty)</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                  {totalUnitsQty != null ? totalUnitsQty : "—"}
                </dd>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Sum of per-platform quantities when set (see <strong className="font-medium text-slate-700">Platforms &amp; equipment</strong>).
                </p>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
          <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
            Case owner, team queue, Deal ID, and optional routing note are edited in{" "}
            <strong className="text-slate-800">Operations &amp; assignment</strong> (alongside this summary on large
            screens; stacked on small screens). Separate from workflow tasks.
          </div>
          {c.partnerName?.trim() ? (
            <div className="rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Partner <span className="font-normal normal-case text-slate-500">(optional)</span>
              </p>
              <div className="mt-2">
                <div className="text-xs uppercase text-slate-500">Name</div>
                <div className="text-slate-900">{c.partnerName.trim()}</div>
              </div>
            </div>
          ) : null}
          {c.supportCoverageIndicator ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage indicator</p>
              <p className="mt-1 text-slate-900">{c.supportCoverageIndicator}</p>
            </div>
          ) : null}
          {c.notes ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">{c.notes}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
        <h2 className="text-sm font-semibold text-slate-900">Operations &amp; assignment</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
          <strong>Assignment</strong> sets the case owner, team queue, Deal ID, and optional routing note on the case
          record. It does not replace individual <strong>workflow tasks</strong> (BU review, eligibility, quotes, etc.)
          in the section below.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Created</dt>
            <dd className="text-slate-900">{c.createdAt.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Last updated</dt>
            <dd className="text-slate-900">{c.updatedAt.toLocaleString()}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Requester email</dt>
            <dd className="truncate text-slate-800" title={c.requester.email}>
              {c.requester.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Deal ID</dt>
            <dd className="font-mono text-slate-900">{dealIdTrimmed || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Current owner</dt>
            <dd className="text-slate-900">{ownershipDisplayForCase(c)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Assigned team</dt>
            <dd className="text-slate-900">{assignedTeamFallbackLabelForCase(c)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Routing note</dt>
            <dd className="whitespace-pre-wrap text-slate-800">
              {(c.routingNote ?? "").trim() || "—"}
            </dd>
          </div>
        </dl>

        {canManageCaseOps ? (
          <div className="mt-5 space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Case actions</h3>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                  <form action={updateCaseStatusAction} className="space-y-2">
                    <p className="text-xs font-medium text-slate-700">Case status</p>
                    <input type="hidden" name="caseId" value={c.id} />
                    <label className="block text-xs text-slate-600">
                      Next status
                      <select
                        name="toStatus"
                        defaultValue={c.status}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        {CASE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {formatCaseStatus(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-slate-600">
                      Status change note{" "}
                      <span className="font-normal text-slate-500">(required for Blocked, Rejected, or Cancelled)</span>
                      <textarea
                        name="reason"
                        rows={2}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Update case status
                    </button>
                  </form>
                </div>

                <div className="rounded-md border border-indigo-100 bg-white p-3 shadow-sm">
                  <form
                    key={`assign-${c.id}-${dealIdTrimmed}-${c.ownerId ?? ""}-${c.assignedTeamId ?? ""}-${(c.routingNote ?? "").slice(0, 24)}`}
                    action={updateCaseAssignmentAction}
                    className="space-y-2"
                  >
                    <p className="text-xs font-medium text-slate-700">Queue, Deal ID &amp; routing note</p>
                    <input type="hidden" name="caseId" value={c.id} />
                    <label className="block text-xs text-slate-600">
                      Deal ID <span className="font-normal text-slate-500">(optional)</span>
                      <input
                        name="dealId"
                        defaultValue={c.dealId ?? ""}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm"
                        placeholder="Leave blank if not known yet"
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      Owner
                      <select
                        name="ownerId"
                        defaultValue={c.ownerId ?? ""}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Unowned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-slate-600">
                      Assigned team / queue
                      <select
                        name="assignedTeamId"
                        defaultValue={c.assignedTeamId ?? ""}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Unassigned queue</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-slate-600">
                      Routing note <span className="font-normal text-slate-500">(optional)</span>
                      <textarea
                        name="routingNote"
                        rows={2}
                        defaultValue={c.routingNote ?? ""}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder="Queue balancing, handoff context, or escalation notes…"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Save queue &amp; Deal ID
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {c.tasks.some((t) => t.type === TaskType.AdditionalInfoRequest && !t.isRunnable) ? (
              <form action={activateAdditionalInfoTaskAction} className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
                <input type="hidden" name="caseId" value={c.id} />
                <p className="text-xs text-amber-900">
                  <strong>Additional Info Request</strong> is on the case but inactive until you need it.
                </p>
                <button
                  type="submit"
                  className="mt-2 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
                >
                  Activate Additional Info task
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            Operations on this panel are restricted to CX Operations or Platform Admin.
          </p>
        )}
      </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
        <h2 className="text-sm font-semibold text-slate-900">Platforms &amp; equipment</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
          Technical line items from intake. BU Review and BU Pricing tasks appear in <strong>Workflow / tasks</strong>{" "}
          below (opened per row when the case is submitted). Per-platform BU/CX costs are edited in{" "}
          <strong>Platform financials</strong> after that section.
        </p>
        {c.assets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No platform rows recorded for this case.</p>
        ) : (
          <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2.5 py-2 font-medium">#</th>
                  <th className="px-2.5 py-2 font-medium">Platform</th>
                  <th className="px-2.5 py-2 font-medium">Software</th>
                  <th className="px-2.5 py-2 font-medium text-right">Quantity</th>
                  <th className="px-2.5 py-2 font-medium">Serial numbers</th>
                  <th className="px-2.5 py-2 font-medium">EoL bulletin</th>
                  <th className="px-2.5 py-2 font-medium">HW LDOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {c.assets.map((a, i) => (
                  <tr key={a.id} className="align-top">
                    <td className="px-2.5 py-2 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-2.5 py-2 font-medium text-slate-900">{a.platformName}</td>
                    <td className="px-2.5 py-2 text-slate-700">{a.softwareVersion ?? "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums text-slate-700">
                      {a.quantity != null ? a.quantity : "—"}
                    </td>
                    <td className="max-w-[14rem] px-2.5 py-2 whitespace-pre-wrap text-slate-700">{a.serialNumbers ?? "—"}</td>
                    <td className="max-w-[10rem] px-2.5 py-2 break-all text-sky-800">
                      {a.eolBulletinLink && /^https?:\/\//i.test(a.eolBulletinLink) ? (
                        <a href={a.eolBulletinLink} target="_blank" rel="noopener noreferrer" className="underline">
                          Open
                        </a>
                      ) : (
                        (a.eolBulletinLink ?? "—")
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-slate-700">
                      {a.hwLdosDate ? a.hwLdosDate.toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Workflow / tasks</h2>
        <p className="mt-1 max-w-3xl text-xs text-slate-600">
          Work items and progress for this case (BU Review / BU Pricing are listed once per platform). Task assignment
          here is separate from <strong>Operations &amp; assignment</strong> at the top of this page. Inactive tasks show{" "}
          <strong>Not active</strong> in # Days active until upstream work completes.{" "}
          <strong>Platform financials</strong> (per line) follow, then <strong>Booking outcome</strong>. Case-level
          financial roll-up is in <strong>Case summary</strong>.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Work item</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Required</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Runnable</th>
                <th className="px-3 py-2"># Days active</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTasks.map((t) => {
                const taskAccess: TaskAccessRow = {
                  ownerId: t.ownerId,
                  assignedTeamId: t.assignedTeamId,
                  type: t.type,
                  isRunnable: t.isRunnable,
                };
                const canEditTask = !readonly && canUpdateTask(user, taskAccess, caseAccess);
                const teamCanActUnowned = !readonly && canActOnUnownedTeamTask(user, taskAccess);
                const readOnlyRow = readonly || !canEditTask;
                const formId = `task-form-${t.id}`;
                const dueStr = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "";
                return (
                  <tr key={t.id}>
                    <td className="min-w-[11rem] px-3 py-2 align-top">
                      <span className="text-sm font-medium text-slate-900">{taskWorkItemLabel(t)}</span>
                      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        {t.caseAsset ? "Per platform" : "Case-wide"}
                      </span>
                    </td>
                    {readOnlyRow ? (
                      <>
                        <td className="px-3 py-2 text-sm text-slate-800">{formatTaskStatus(t.status)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{t.owner?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{t.assignedTeam?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{t.dueDate ? t.dueDate.toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{t.isRequired ? "Yes" : "No"}</td>
                        <td className="max-w-[14rem] px-3 py-2 text-xs text-slate-700">
                          {t.notes?.trim() ? <p className="whitespace-pre-wrap">{t.notes}</p> : <span className="text-slate-400">—</span>}
                          {t.blockerReason?.trim() ? (
                            <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-rose-300 pl-2 text-rose-900">
                              <span className="font-semibold">Blocker: </span>
                              {t.blockerReason}
                            </p>
                          ) : null}
                          {t.notRequiredReason?.trim() ? (
                            <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-amber-300 pl-2 text-amber-950">
                              <span className="font-semibold">Not required: </span>
                              {t.notRequiredReason}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{t.isRunnable ? "Yes" : "No"}</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-slate-600">
                          {daysActiveDisplay(t.activatedAt, t.isRunnable)}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-400">—</td>
                      </>
                    ) : (
                      <>
                        <TaskRowForm
                          formId={formId}
                          taskStatuses={TASK_STATUSES}
                          defaultStatus={t.status}
                          defaultNotes={t.notes ?? ""}
                          defaultBlockerReason={t.blockerReason}
                          defaultNotRequiredReason={t.notRequiredReason}
                          canEditTask={canEditTask}
                          canManageAssignments={canManageCaseOps}
                          users={users}
                          teams={teams}
                          defaultOwnerId={t.ownerId}
                          defaultTeamId={t.assignedTeamId}
                          defaultDue={dueStr}
                          defaultIsRequired={t.isRequired}
                          ownershipCaption={ownershipDisplayForTask(t)}
                          showTeamQueueHint={teamCanActUnowned}
                        />
                        <td className="px-3 py-2 text-xs text-slate-600">{t.isRunnable ? "Yes" : "No"}</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-slate-600">
                          {daysActiveDisplay(t.activatedAt, t.isRunnable)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <form id={formId} action={updateTaskAction}>
                            <input type="hidden" name="caseId" value={c.id} />
                            <input type="hidden" name="taskId" value={t.id} />
                          </form>
                          <button
                            form={formId}
                            type="submit"
                            disabled={!canEditTask}
                            className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Save task
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canManageCaseOps ? (
          <form action={createTaskAction} className="mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
            <input type="hidden" name="caseId" value={c.id} />
            <select name="type" defaultValue={TaskType.BUReview} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
              {TASK_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {formatTaskType(tt)}
                </option>
              ))}
            </select>
            <select name="ownerId" defaultValue="" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
              <option value="">Owner — unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select name="assignedTeamId" defaultValue="" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
              <option value="">Team — unassigned</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input type="date" name="dueDate" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
            <input
              name="notes"
              placeholder="Optional task notes"
              className="sm:col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
            />
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
              Add task
            </button>
          </form>
        ) : null}
      </section>

      {c.assets.length > 0 ? (
        <section className="rounded-xl border border-slate-300/80 bg-slate-50/50 p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
          <h2 className="text-sm font-semibold text-slate-900">Platform financials</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            Per-platform BU and CX (demo USD). Line total updates live while you edit. Rolled-up totals for the whole
            case are shown in <strong>Case summary</strong>.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.assets.map((a) => (
              <PlatformAssetCostEditor
                key={`${a.id}-${a.buCost}-${a.cxCost}`}
                caseId={c.id}
                assetId={a.id}
                platformLabel={a.platformName}
                initialBuCost={a.buCost}
                initialCxCost={a.cxCost}
                canEdit={canEditCaseFinancials}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-violet-200/80 bg-violet-50/30 p-5 shadow-sm ring-1 ring-violet-900/[0.04]">
        <h2 className="text-sm font-semibold text-slate-900">Booking outcome</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
          Commercial result for this case (after workflow and platform financials above; separate from the Operations &
          assignment panel). Reason is shown only when the booking status is Not booked or Passed over.
        </p>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-md border border-white/60 bg-white/80 px-3 py-2 shadow-sm">
            <dt className="font-medium text-slate-500">Quote booking status</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{formatQuoteBookingStatus(c.quoteBookingStatus)}</dd>
          </div>
          {quoteBookingNeedsReason(c.quoteBookingStatus) ? (
            <div className="rounded-md border border-white/60 bg-white/80 px-3 py-2 shadow-sm sm:col-span-1">
              <dt className="font-medium text-slate-500">Not booked reason</dt>
              <dd className="mt-0.5 text-sm leading-snug text-slate-800">
                {c.notBookedReason?.trim() ? c.notBookedReason : "— (no reason recorded)"}
              </dd>
            </div>
          ) : null}
        </dl>
        {canEditCaseFinancials ? (
          <BookingOutcomeForm
            key={`booking-${c.quoteBookingStatus}-${c.notBookedReason ?? ""}`}
            caseId={c.id}
            defaultStatus={c.quoteBookingStatus}
            defaultReason={c.notBookedReason}
          />
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            Read-only for this account. Booking updates use the same permissions as other case edits (e.g. CX Operations
            or Platform Admin).
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">External references</h2>
        <div className="mt-3 space-y-3">
          {c.references.length === 0 ? <p className="text-sm text-slate-500">None recorded.</p> : null}
          {c.references.map((r) => (
            <form key={r.id} action={upsertExternalReferenceAction} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <input type="hidden" name="caseId" value={c.id} />
              <input type="hidden" name="existingReferenceId" value={r.id} />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <select name="referenceType" defaultValue={r.referenceType} disabled={!canEditReferences} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                  {EXTERNAL_REFERENCE_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
                <input name="referenceId" defaultValue={r.referenceId} disabled={!canEditReferences} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-mono" />
                <select name="taskId" defaultValue={r.taskId ?? ""} disabled={!canEditReferences} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                  <option value="">Case-level ref</option>
                  {sortedTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {taskWorkItemLabel(t)} ({t.id.slice(-6)})
                    </option>
                  ))}
                </select>
                <input name="externalStatus" defaultValue={r.externalStatus ?? ""} disabled={!canEditReferences} placeholder="External status" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
                <button type="submit" disabled={!canEditReferences} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  Save
                </button>
              </div>
              <textarea
                name="notes"
                defaultValue={r.notes ?? ""}
                disabled={!canEditReferences}
                placeholder="Reference notes"
                rows={2}
                className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              />
            </form>
          ))}
          <form action={upsertExternalReferenceAction} className="rounded-md border border-slate-200 bg-white p-3">
            <input type="hidden" name="caseId" value={c.id} />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add external reference</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select name="referenceType" defaultValue={EXTERNAL_REFERENCE_TYPES[0]} disabled={!canEditReferences} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                {EXTERNAL_REFERENCE_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
              <input name="referenceId" disabled={!canEditReferences} required className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-mono" placeholder="Reference ID" />
              <select name="taskId" defaultValue="" disabled={!canEditReferences} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                <option value="">Case-level ref</option>
                {sortedTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {taskWorkItemLabel(t)} ({t.id.slice(-6)})
                  </option>
                ))}
              </select>
              <input name="externalStatus" disabled={!canEditReferences} placeholder="External status" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
              <button type="submit" disabled={!canEditReferences} className="rounded-md bg-slate-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                Add
              </button>
            </div>
            <textarea name="notes" disabled={!canEditReferences} rows={2} placeholder="Notes" className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
          </form>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Comments / notes</h2>
          {canAddComment ? (
            <form action={addCommentAction} className="mt-3 space-y-2">
              <input type="hidden" name="caseId" value={c.id} />
              <textarea
                name="body"
                required
                rows={3}
                placeholder="Add operational comment..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                Add comment
              </button>
            </form>
          ) : null}
          <ul className="mt-3 space-y-3 text-sm">
            {c.comments.length === 0 ? <li className="text-slate-500">No comments yet.</li> : null}
            {c.comments.map((m) => (
              <li key={m.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">
                  {m.user.name} · {m.createdAt.toLocaleString()}
                </div>
                <div className="mt-1 text-slate-800">{m.body}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Activity log</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {c.activities.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="shrink-0 text-xs text-slate-500">{a.createdAt.toLocaleString()}</span>
                <span className="text-slate-800">
                  <span className="font-medium">{a.user?.name ?? "System"}</span>: {a.action}
                  {a.details ? <span className="text-slate-600"> — {a.details}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Attachments</h2>
        {canAddAttachment ? (
          <form action={addAttachmentMetadataAction} className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
            <input type="hidden" name="caseId" value={c.id} />
            <input name="fileName" required placeholder="File name" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs sm:col-span-2" />
            <input name="mimeType" placeholder="MIME type" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
            <input name="sizeBytes" type="number" min={0} placeholder="Bytes" className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 sm:col-span-1">
              Add metadata
            </button>
          </form>
        ) : null}
        <ul className="mt-3 space-y-2 text-sm">
          {c.attachments.length === 0 ? <li className="text-slate-500">None.</li> : null}
          {c.attachments.map((a) => (
            <li key={a.id} className="text-slate-700">
              <span className="font-medium">{a.fileName}</span>
              <div className="text-xs text-slate-500">
                Path: <span className="font-mono">{a.filePath}</span> · {a.uploadedBy.name}
                {a.mimeType ? ` · ${a.mimeType}` : null}
                {a.sizeBytes != null ? ` · ${(a.sizeBytes / 1024).toFixed(1)} KB` : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
