import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env/demo-mode";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardGroupLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  return (
    <DashboardShell user={user} demoMode={isDemoMode()}>
      {children}
    </DashboardShell>
  );
}
