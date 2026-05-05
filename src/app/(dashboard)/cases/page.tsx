import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { listCasesVisibleToUser } from "@/lib/cases/queries";
import { isPortfolioWideCaseViewer } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCaseStatus, formatRequestType } from "@/lib/ui/format";
import {
  caseListDealIdDisplay,
  caseListPlatformSummary,
  caseListTaskWorkHint,
  caseListTaskWorkHintForUser,
} from "@/lib/cases/list-display";
import { parseCaseListStatusParam } from "@/lib/cases/case-list-filters";

export default async function CasesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const sp = await searchParams;
  const statusRaw = sp.status;
  const statusParam = typeof statusRaw === "string" ? statusRaw : statusRaw?.[0];
  const statusFilter = parseCaseListStatusParam(statusParam);

  const allVisible = await listCasesVisibleToUser(user);
  const rows = statusFilter ? allVisible.filter((r) => r.status === statusFilter) : allVisible;
  const portfolioWide = isPortfolioWideCaseViewer(user);
  const createdByMe = rows.filter((r) => r.requesterId === user.id);
  const assignedToMe = rows.filter((r) => r.requesterId !== user.id);
  const userTeamIds = new Set(user.teams.map((t) => t.id));
  const taskHintForUser = { userId: user.id, teamIds: userTeamIds };

  const totalVisible = allVisible.length;
  const filterYieldsNone = statusFilter != null && rows.length === 0 && totalVisible > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <PageHeader
        title="Cases"
        description={
          portfolioWide
            ? `Portfolio-wide queue (CX / leadership / platform visibility). ${statusFilter ? `${rows.length} case${rows.length === 1 ? "" : "s"} match the status filter (${totalVisible} visible overall).` : `${rows.length} case${rows.length === 1 ? "" : "s"}`} — each row opens in your workspace.`
            : `${statusFilter ? `${rows.length} case${rows.length === 1 ? "" : "s"} match the filter (${totalVisible} visible overall).` : `${rows.length} case${rows.length === 1 ? "" : "s"} you may open`} — created by you or where you are on a task; counts match these tables.`
        }
      />

      {statusFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
          <span>
            Filtered by status: <strong>{formatCaseStatus(statusFilter)}</strong>
          </span>
          <Link href="/cases" className="font-medium text-sky-900 underline decoration-sky-600/60 hover:text-sky-950">
            Clear filter
          </Link>
        </div>
      ) : null}

      {filterYieldsNone ? (
        <EmptyState
          title="No cases with this status in your view"
          description={`None of your ${totalVisible} visible case${totalVisible === 1 ? "" : "s"} are in “${formatCaseStatus(statusFilter!)}”. Clear the filter or pick another status from the Home chart.`}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No cases in your view"
          description="Nothing is visible for this account yet — for example a seeded demo user with no requests and no task assignments. Create a request if your role allows, or sign in as another persona."
        />
      ) : portfolioWide ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">All cases</h2>
          <p className="text-xs text-slate-500">
            Full portfolio aligned with your role. Task counts summarize pipeline activity on each case (not “assigned to you” unless you use a scoped persona).
          </p>
          <CaseTable rows={rows} />
        </section>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Created by me ({createdByMe.length})
            </h2>
            <p className="text-xs text-slate-500">Requests you submitted (you are the requester on the case).</p>
            {createdByMe.length === 0 ? (
              <p className="text-sm text-slate-500">You have not created any visible requests.</p>
            ) : (
              <CaseTable rows={createdByMe} taskHintForUser={taskHintForUser} />
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assigned / on my queues ({assignedToMe.length})
            </h2>
            <p className="text-xs text-slate-500">
              Cases you did not create but can see because you are a direct assignee or member of a task&apos;s team queue.
            </p>
            {assignedToMe.length === 0 ? (
              <p className="text-sm text-slate-500">No shared or assigned work in your view right now.</p>
            ) : (
              <CaseTable rows={assignedToMe} taskHintForUser={taskHintForUser} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CaseTable({
  rows,
  taskHintForUser,
}: {
  rows: Awaited<ReturnType<typeof listCasesVisibleToUser>>;
  /** When set, Tasks column shows open-runnable count involving this user (multi-assignee–aware). */
  taskHintForUser?: { userId: string; teamIds: Set<string> };
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Case ID</th>
            <th className="px-4 py-2">Deal ID</th>
            <th className="px-4 py-2">Platforms</th>
            <th className="px-4 py-2">Tasks</th>
            <th className="px-4 py-2">Customer</th>
            <th className="px-4 py-2">Service</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Priority</th>
            <th className="px-4 py-2">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/80">
              <td className="px-4 py-2">
                <Link href={`/cases/${c.id}`} className="font-mono text-sky-800 hover:underline">
                  {c.caseId}
                </Link>
              </td>
              <td className="px-4 py-2 font-mono text-xs text-slate-600">{caseListDealIdDisplay(c.dealId)}</td>
              <td className="px-4 py-2 text-slate-700" title={caseListPlatformSummary(c)}>
                {caseListPlatformSummary(c)}
              </td>
              <td className="px-4 py-2 text-xs text-slate-600">
                {taskHintForUser
                  ? caseListTaskWorkHintForUser(c, taskHintForUser.userId, taskHintForUser.teamIds)
                  : caseListTaskWorkHint(c)}
              </td>
              <td className="px-4 py-2 text-slate-800">{c.customerName}</td>
              <td className="px-4 py-2 text-slate-700">{formatRequestType(c.requestType)}</td>
              <td className="px-4 py-2">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-2">
                <PriorityBadge priority={c.priority} />
              </td>
              <td className="px-4 py-2 text-slate-600">{c.updatedAt.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
