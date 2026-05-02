import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canViewReports, isReadOnlyDemoUser } from "@/lib/rbac";
import { getReportsPageData } from "@/lib/reports/dashboard-metrics";
import { parseReportsFilters } from "@/lib/reports/reports-filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportsDashboardView } from "@/components/reports/ReportsDashboardView";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (!canViewReports(user)) redirect("/");

  const sp = await searchParams;
  const filters = parseReportsFilters(sp);
  const data = await getReportsPageData(user, filters);
  const readOnly = isReadOnlyDemoUser(user);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        title="Reports"
        description={
          readOnly
            ? "Read-only portfolio metrics and commercial signals. Data matches cases you are allowed to see."
            : "Operational and commercial KPIs for cases in your visibility scope."
        }
      />

      <ReportsDashboardView data={data} />
    </div>
  );
}
