import type { SessionUser } from "@/lib/auth/session";
import type { CaseListRow } from "@/lib/cases/queries";
import {
  caseStatusDistribution,
  dedupeCasesById,
  filterCasesAwaitingMyInput,
  filterCasesReturnedForMoreInformation,
  filterMyActiveCases,
  type StatusCount,
} from "@/lib/home/worklists";
import { CaseStatusDistribution } from "@/components/home/CaseStatusDistribution";
import { HomeWorkSection } from "@/components/home/HomeWorkSection";
import { isPortfolioWideCaseViewer, isReadOnlyDemoUser } from "@/lib/rbac";

const LIST_CAP = 10;

type Props = {
  user: SessionUser;
  visibleCases: CaseListRow[];
  /** Status chart links: Reports for ops roles; Cases list for users without Reports so counts stay drillable. */
  statusBarLinkTarget: "reports" | "cases";
};

function capNote(total: number): string {
  if (total <= LIST_CAP) return "";
  return ` Showing ${LIST_CAP} of ${total}; open Cases for the full list.`;
}

export function HomeWorkDashboard({ user, visibleCases, statusBarLinkTarget }: Props) {
  const portfolioWide = isPortfolioWideCaseViewer(user);
  const myActiveAll = dedupeCasesById(filterMyActiveCases(user, visibleCases));
  const awaitingAll = dedupeCasesById(filterCasesAwaitingMyInput(user, visibleCases));
  const returnedAll = dedupeCasesById(filterCasesReturnedForMoreInformation(user, visibleCases));
  const myActive = myActiveAll.slice(0, LIST_CAP);
  const awaiting = awaitingAll.slice(0, LIST_CAP);
  const returned = returnedAll.slice(0, LIST_CAP);
  const distribution: StatusCount[] = caseStatusDistribution(visibleCases);
  const readOnly = isReadOnlyDemoUser(user);

  return (
    <div className="space-y-6">
      <HomeWorkSection
        title={portfolioWide ? "Active cases (portfolio)" : "My active cases"}
        description={
          (portfolioWide
            ? "Non-terminal cases across the full portfolio visible to CX / admin / leadership. Counts match the status chart and case list."
            : "Non-closed cases you are tied to — requester, direct assignee, or task queue. Counts match what you can open on the Cases page.") + capNote(myActiveAll.length)
        }
        cases={myActive}
        emptyLabel="No active cases in your view right now."
      />

      <HomeWorkSection
        title="Cases awaiting my input"
        description={
          (readOnly
            ? "Read-only accounts see portfolio lists elsewhere; actionable task queues are hidden here by design."
            : portfolioWide
              ? "Runnable tasks your role may update anywhere in the visible portfolio (CX / admin)."
              : "Runnable tasks you may update on your visible cases only (assignee, team queue, or allowed unowned queue work).") + (readOnly ? "" : capNote(awaitingAll.length))
        }
        cases={readOnly ? [] : awaiting}
        emptyLabel={
          readOnly ? "No action queue for read-only leadership." : "Nothing is waiting on you at the moment."
        }
      />

      <HomeWorkSection
        title="Cases returned for more information"
        description={
          "Awaiting Info in your scope, or an active Additional Info Request task relevant to your role." +
          capNote(returnedAll.length)
        }
        cases={returned}
        emptyLabel="No cases are waiting on more information in your view."
      />

      <CaseStatusDistribution
        distribution={distribution}
        statusBarLinkTarget={statusBarLinkTarget}
        viewerScope={portfolioWide ? "portfolio" : "scoped"}
      />
    </div>
  );
}
