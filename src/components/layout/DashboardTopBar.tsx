import type { SessionUser } from "@/lib/auth/session";
import { formatRoleLabels } from "@/lib/auth/role-labels";
import { DemoPersonaSwitcher } from "@/components/layout/DemoPersonaSwitcher";

type Props = {
  user: SessionUser;
  demoMode: boolean;
};

/** Sticky header: identity + roles for RBAC demos; optional persona switcher when `DEMO_MODE`. */
export function DashboardTopBar({ user, demoMode }: Props) {
  const roleLabels = formatRoleLabels(user.roles);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900" title={user.name}>
          {user.name}
        </p>
        <p className="truncate text-xs text-slate-600" title={user.email}>
          {user.email}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Assigned roles">
          {roleLabels.map((label) => (
            <span
              key={label}
              className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {demoMode ? (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Demo mode</span>
          <DemoPersonaSwitcher currentEmail={user.email} />
        </div>
      ) : null}
    </header>
  );
}
