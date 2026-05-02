import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canCreateRequest } from "@/lib/rbac";
import { getDraftCaseForUser } from "@/lib/cases/queries";
import { caseToIntakeFormValues } from "@/lib/cases/intake-map";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewCaseForm } from "./NewCaseForm";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const canCreate = canCreateRequest(user);

  const sp = await searchParams;
  const draftParam = typeof sp.draft === "string" ? sp.draft : undefined;
  const draftRow = draftParam ? await getDraftCaseForUser(user, draftParam) : null;
  const initialDefaults = draftRow ? caseToIntakeFormValues(draftRow) : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="Create request"
        description="Multi-step intake for EoVSS, EoSM (End of Software Maintenance), and ESS/MSS. Partner and quantity are optional. Deal ID is optional—CX Operations or your partner administrator can add it later on the case. Add one card per platform; save drafts anytime. Submit validates the full intake, assigns a public case ID from the selected service (EoVSS-, EoSM-, or ESSMSS- prefix), creates platform records, and opens the default task set (Intake Validation starts active immediately)."
      />

      {canCreate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <NewCaseForm key={draftRow?.id ?? "new-intake"} initialDefaults={initialDefaults} />
        </div>
      ) : (
        <EmptyState
          title="Request creation not available for this account"
          description="Your current roles are limited to read or assigned work in this demo. Use sales.demo@local or cx.demo@local to create requests."
        />
      )}
    </div>
  );
}
