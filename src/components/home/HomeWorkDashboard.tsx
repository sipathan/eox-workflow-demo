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
import { isReadOnlyDemoUser } from "@/lib/rbac";

const LIST_CAP = 10;

type Props = {
  user: SessionUser;
  visibleCases: CaseListRow[];
  /** When true, each status row in the distribution chart links to `/reports?status=…`. */
  linkStatusChartToReports?: boolean;
};

export function HomeWorkDashboard({ user, visibleCases, linkStatusChartToReports = false }: Props) {
  const myActive = dedupeCasesById(filterMyActiveCases(user, visibleCases)).slice(0, LIST_CAP);
  const awaiting = dedupeCasesById(filterCasesAwaitingMyInput(user, visibleCases)).slice(0, LIST_CAP);
  const returned = dedupeCasesById(filterCasesReturnedForMoreInformation(user, visibleCases)).slice(0, LIST_CAP);
  const distribution: StatusCount[] = caseStatusDistribution(visibleCases);
  const readOnly = isReadOnlyDemoUser(user);

  return (
    <div className="space-y-6">
      <HomeWorkSection
        title="My active cases"
        description="Non-closed work you are tied to — drafts you own, pipeline cases you follow, or the full operational portfolio when you run CX, admin, or leadership views."
        cases={myActive}
        emptyLabel="No active cases in your view right now."
      />

      <HomeWorkSection
        title="Cases awaiting my input"
        description={
          readOnly
            ? "Read-only accounts see portfolio lists elsewhere; actionable task queues are hidden here by design."
            : "Runnable tasks you are allowed to update (owned, team queue, or CX/admin coverage) that are not yet completed."
        }
        cases={readOnly ? [] : awaiting}
        emptyLabel={
          readOnly ? "No action queue for read-only leadership." : "Nothing is waiting on you at the moment."
        }
      />

      <HomeWorkSection
        title="Cases returned for more information"
        description="Case status is Awaiting Info, or an Additional Info Request task is active and relevant to your role."
        cases={returned}
        emptyLabel="No cases are waiting on more information in your view."
      />

      <CaseStatusDistribution distribution={distribution} linkRowsToReports={linkStatusChartToReports} />
    </div>
  );
}
