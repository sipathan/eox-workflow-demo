import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopBar } from "@/components/layout/DashboardTopBar";

type Props = {
  user: SessionUser;
  demoMode: boolean;
  children: ReactNode;
};

/** Shared left nav + main column for signed-in operational pages. */
export function DashboardShell({ user, demoMode, children }: Props) {
  return (
    <div className="flex min-h-full w-full flex-1">
      <DashboardSidebar user={user} />
      <div className="flex min-h-full min-w-0 flex-1 flex-col bg-white">
        <DashboardTopBar user={user} demoMode={demoMode} />
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
