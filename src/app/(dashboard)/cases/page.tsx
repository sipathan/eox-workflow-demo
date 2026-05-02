import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { listCasesVisibleToUser, myWorkCases } from "@/lib/cases/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRequestType } from "@/lib/ui/format";
import {
  caseListDealIdDisplay,
  caseListPlatformSummary,
  caseListTaskWorkHint,
} from "@/lib/cases/list-display";

export default async function CasesListPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const rows = await listCasesVisibleToUser(user);
  const mine = myWorkCases(user, rows);
  const mineIds = new Set(mine.map((c) => c.id));
  const otherVisible = rows.filter((c) => !mineIds.has(c.id));
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <PageHeader
        title="Cases"
        description="Queue and assignments scoped to your demo role. Open a row for the full case workspace."
      />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">My work</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500">No cases in your direct queue right now.</p>
        ) : (
          <CaseTable rows={mine} />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {mine.length > 0 ? "Other visible cases" : "All visible"}
        </h2>
        {mine.length > 0 ? (
          <p className="text-xs text-slate-500">
            Rows above are your direct queue; this table lists the rest of your portfolio (no duplicates).
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No cases visible for this account.</p>
        ) : mine.length > 0 && otherVisible.length === 0 ? (
          <p className="text-sm text-slate-500">No additional cases beyond your work queue.</p>
        ) : (
          <CaseTable rows={mine.length > 0 ? otherVisible : rows} />
        )}
      </section>

    </div>
  );
}

function CaseTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof listCasesVisibleToUser>>;
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
              <td className="px-4 py-2 text-xs text-slate-600">{caseListTaskWorkHint(c)}</td>
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
