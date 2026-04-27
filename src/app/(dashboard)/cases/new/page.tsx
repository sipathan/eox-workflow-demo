import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleKey } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { hasAnyRole, isReadOnlyDemoUser } from "@/lib/rbac";
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

  const canCreate =
    !isReadOnlyDemoUser(user) &&
    hasAnyRole(user, [RoleKey.ACCOUNT_TEAM, RoleKey.CX_OPS, RoleKey.PLATFORM_ADMIN]);

  const sp = await searchParams;
  const draftParam = typeof sp.draft === "string" ? sp.draft : undefined;
  const draftRow = draftParam ? await getDraftCaseForUser(user, draftParam) : null;
  const initialDefaults = draftRow ? caseToIntakeFormValues(draftRow) : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <p className="text-sm text-slate-500">
        <Link href="/cases" className="text-sky-700 hover:underline">
          Cases
        </Link>
        <span className="mx-1">/</span>
        <span>New request</span>
      </p>

      <PageHeader
        title="Create request"
        description="Multi-step intake for EoVSS, EoSM, and EoSS. Save drafts anytime; submit runs full validation and routes to CX Ops Global."
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
