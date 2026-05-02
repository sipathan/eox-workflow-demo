import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

type Props = {
  user: SessionUser;
  children: ReactNode;
};

/** Shared left nav + main column for signed-in operational pages. */
export function DashboardShell({ user, children }: Props) {
  return (
    <div className="flex min-h-full w-full flex-1">
      <DashboardSidebar user={user} />
      <div className="min-h-full min-w-0 flex-1 bg-white">{children}</div>
    </div>
  );
}
