import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CaseStatus,
  ExternalReferenceType,
  RoleKey,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getCaseByIdForUser } from "@/lib/cases/queries";
import {
  addAttachmentMetadataAction,
  addCommentAction,
  createTaskAction,
  updateCaseAssignmentAction,
  updateCaseStatusAction,
  updateTaskAction,
  upsertExternalReferenceAction,
} from "@/app/actions/case-workspace";
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
import { formatCaseStatus, formatRequestType, formatTaskStatus, formatTaskType } from "@/lib/ui/format";
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
  if (!user) return <></>;

  const c = await getCaseByIdForUser(user, id);
  if (!c) notFound();
  const readonly = isReadOnlyDemoUser(user);
  const caseAccess = toCaseAccessRow(c);
  const canManageCaseStatus =
    !readonly &&
    canUpdateCase(user, { ...caseAccess, status: c.status }) &&
    hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
  const canManageTasks = !readonly && hasAnyRole(user, [RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);
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
    <div className="space-y-6">
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

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">Case summary</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">Case ID</dt>
              <dd className="font-mono text-slate-900">{c.caseId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Request type</dt>
              <dd className="text-slate-900">{formatRequestType(c.requestType)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Customer</dt>
              <dd className="text-slate-900">{c.customerName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Deal ID</dt>
              <dd className="font-mono text-slate-900">{c.dealId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Status</dt>
              <dd>
                <StatusBadge status={c.status} />
              </dd>
            </div>
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
            <div>
              <dt className="text-xs uppercase text-slate-500">Owner</dt>
              <dd className="text-slate-900">{ownershipDisplayForCase(c)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Assigned team</dt>
              <dd className="text-slate-900">{assignedTeamFallbackLabelForCase(c)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Platform / SW</dt>
              <dd className="text-slate-900">
                {c.platform} · {c.softwareVersion}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-slate-500">Business justification</dt>
              <dd className="text-slate-800">{c.businessJustification}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-slate-500">Migration plan</dt>
              <dd className="text-slate-800">{c.migrationPlan ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Extension window</dt>
              <dd className="text-slate-900">
                {c.extensionStartDate && c.extensionEndDate
                  ? `${c.extensionStartDate.toLocaleDateString()} → ${c.extensionEndDate.toLocaleDateString()}`
                  : "—"}
              </dd>
            </div>
            {c.partnerName ? (
              <div>
                <dt className="text-xs uppercase text-slate-500">Partner</dt>
                <dd className="text-slate-900">{c.partnerName}</dd>
              </div>
            ) : null}
            {c.quantity != null ? (
              <div>
                <dt className="text-xs uppercase text-slate-500">Quantity</dt>
                <dd className="text-slate-900">{c.quantity}</dd>
              </div>
            ) : null}
            {c.eolBulletinLink ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-slate-500">EoL bulletin</dt>
                <dd className="text-slate-800">
                  {/^https?:\/\//i.test(c.eolBulletinLink) ? (
                    <a
                      href={c.eolBulletinLink}
                      className="text-sky-800 underline break-all"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c.eolBulletinLink}
                    </a>
                  ) : (
                    <span className="break-all">{c.eolBulletinLink}</span>
                  )}
                </dd>
              </div>
            ) : null}
            {c.serialNumbers ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-slate-500">Serials / assets</dt>
                <dd className="whitespace-pre-wrap text-slate-800">{c.serialNumbers}</dd>
              </div>
            ) : null}
            {c.supportCoverageIndicator ? (
              <div>
                <dt className="text-xs uppercase text-slate-500">Coverage indicator</dt>
                <dd className="text-slate-900">{c.supportCoverageIndicator}</dd>
              </div>
            ) : null}
            {c.hwLdosDate ? (
              <div>
                <dt className="text-xs uppercase text-slate-500">HW LDOS</dt>
                <dd className="text-slate-900">{c.hwLdosDate.toLocaleDateString()}</dd>
              </div>
            ) : null}
            {c.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-slate-500">Notes</dt>
                <dd className="whitespace-pre-wrap text-slate-800">{c.notes}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Case metadata</h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500">Created</dt>
              <dd className="text-slate-900">{c.createdAt.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Last updated</dt>
              <dd className="text-slate-900">{c.updatedAt.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Requester email</dt>
              <dd className="text-slate-700">{c.requester.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Current status</dt>
              <dd>
                <StatusBadge status={c.status} />
              </dd>
            </div>
          </dl>
          {canManageCaseStatus ? (
            <form action={updateCaseStatusAction} className="mt-4 space-y-2 rounded-md border border-slate-200 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Case actions</h3>
              <input type="hidden" name="caseId" value={c.id} />
              <label className="block text-xs text-slate-600">
                Next status
                <select name="toStatus" defaultValue={c.status} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  {CASE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {formatCaseStatus(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-600">
                Reason (required for Blocked / Rejected / Cancelled)
                <textarea name="reason" rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                Update case status
              </button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-slate-500">Case status updates are restricted to CX Ops / Platform Admin.</p>
          )}
          {canManageTasks ? (
            <form action={updateCaseAssignmentAction} className="mt-4 space-y-2 rounded-md border border-slate-200 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reassign case queue</h3>
              <input type="hidden" name="caseId" value={c.id} />
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
                Reason (optional)
                <input
                  name="reason"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Queue balancing, handoff, escalation..."
                />
              </label>
              <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Save assignment
              </button>
            </form>
          ) : null}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Workflow / tasks</h2>
        <p className="mt-1 text-xs text-slate-500">Operational task workspace with assignment-aware editing controls.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Required</th>
                <th className="px-3 py-2">Notes / blockers / not-required reason</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.tasks.map((t) => {
                const taskAccess: TaskAccessRow = {
                  ownerId: t.ownerId,
                  assignedTeamId: t.assignedTeamId,
                  type: t.type,
                };
                const canEditTask = !readonly && canUpdateTask(user, taskAccess, caseAccess);
                const teamCanActUnowned = !readonly && canActOnUnownedTeamTask(user, taskAccess);
                const formId = `task-form-${t.id}`;
                return (
                  <tr key={t.id}>
                    <td className="px-3 py-2 text-slate-800">{formatTaskType(t.type)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      <select
                        form={formId}
                        name="status"
                        defaultValue={t.status}
                        disabled={!canEditTask}
                        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {formatTaskStatus(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <select
                        form={formId}
                        name="ownerId"
                        defaultValue={t.ownerId ?? ""}
                        disabled={!canManageTasks}
                        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="">—</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-[10px] text-slate-500">{ownershipDisplayForTask(t)}</div>
                      {teamCanActUnowned ? (
                        <div className="text-[10px] text-emerald-700">Team queue task: you can act without individual owner.</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <select
                        form={formId}
                        name="assignedTeamId"
                        defaultValue={t.assignedTeamId ?? ""}
                        disabled={!canManageTasks}
                        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="">—</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <input
                        type="date"
                        form={formId}
                        name="dueDate"
                        defaultValue={t.dueDate ? t.dueDate.toISOString().slice(0, 10) : ""}
                        disabled={!canManageTasks}
                        className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <select
                        form={formId}
                        name="isRequired"
                        defaultValue={String(t.isRequired)}
                        disabled={!canEditTask}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="space-y-1">
                        <textarea
                          form={formId}
                          name="notes"
                          defaultValue={t.notes ?? ""}
                          placeholder="Notes"
                          disabled={!canEditTask}
                          rows={2}
                          className="w-56 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          form={formId}
                          name="blockerReason"
                          defaultValue={t.blockerReason ?? ""}
                          placeholder="Blocker reason"
                          disabled={!canEditTask}
                          className="w-56 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          form={formId}
                          name="notRequiredReason"
                          defaultValue={t.notRequiredReason ?? ""}
                          placeholder="Not required reason"
                          disabled={!canEditTask}
                          className="w-56 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>
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
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Save task
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canManageTasks ? (
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
                  {c.tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTaskType(t.type)} ({t.id.slice(-6)})
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
                {c.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatTaskType(t.type)} ({t.id.slice(-6)})
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
