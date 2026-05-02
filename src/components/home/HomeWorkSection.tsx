import Link from "next/link";
import type { CaseListRow } from "@/lib/cases/queries";
import {
  caseListDealIdDisplay,
  caseListPlatformSummary,
  caseListTaskWorkHint,
} from "@/lib/cases/list-display";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRequestType } from "@/lib/ui/format";

type Props = {
  title: string;
  description: string;
  cases: CaseListRow[];
  emptyLabel: string;
};

export function HomeWorkSection({ title, description, cases, emptyLabel }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
      <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      {cases.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="group flex flex-col gap-1 rounded-lg py-3 transition hover:bg-slate-50 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1 sm:px-2"
              >
                <span className="font-mono text-sm font-medium text-sky-800 group-hover:underline">{c.caseId}</span>
                <StatusBadge status={c.status} />
                <span className="text-xs font-medium text-slate-700">{formatRequestType(c.requestType)}</span>
                <span className="text-sm text-slate-600">{caseListPlatformSummary(c)}</span>
                <span className="text-xs text-slate-500 sm:ml-auto">
                  Deal {caseListDealIdDisplay(c.dealId)} · {caseListTaskWorkHint(c)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
