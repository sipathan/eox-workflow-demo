import { demoLoginAction } from "@/app/actions/auth";
import { SignedInHomeBrandBanner } from "@/components/branding/SignedInHomeBrandBanner";
import { CiscoBrandLogo } from "@/components/branding/CiscoBrandLogo";
import { HomeKpiCards } from "@/components/home/HomeKpiCards";
import { HomeWorkDashboard } from "@/components/home/HomeWorkDashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DEMO_LOGIN_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env/demo-mode";
import { listCasesVisibleToUser } from "@/lib/cases/queries";
import { buildHomeKpiCounts } from "@/lib/home/home-kpis";
import { canViewReports } from "@/lib/rbac";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const sp = await searchParams;
  const loginErr = sp.login;
  const user = await getSessionUser();
  const visibleCases = user != null ? await listCasesVisibleToUser(user) : [];
  const homeKpis = user != null ? buildHomeKpiCounts(user, visibleCases) : null;

  if (user) {
    return (
      <DashboardShell user={user} demoMode={isDemoMode()}>
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
          <SignedInHomeBrandBanner />

          <header className="space-y-2 border-b border-slate-200/80 pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Home</h1>
            <p className="text-sm text-slate-600">
              Signed in as <span className="font-medium text-slate-900">{user.name}</span>{" "}
              <span className="text-slate-500">({user.email})</span>
            </p>
          </header>

          {homeKpis ? <HomeKpiCards counts={homeKpis} /> : null}

          {loginErr === "invalid" ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              Invalid email or password.
            </p>
          ) : null}
          {loginErr === "config" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Set <code className="font-mono text-xs">SESSION_SECRET</code> in <code className="font-mono text-xs">.env</code>{" "}
              to at least 32 characters (see <code className="font-mono text-xs">.env.example</code>), then restart{" "}
              <code className="font-mono text-xs">npm run dev</code>.
            </p>
          ) : null}

          {visibleCases.length === 0 ? (
            <EmptyState
              title="No cases in your view"
              description="This account does not yet have any visible requests or task assignments. If your role allows, create a request from the navigation, or sign in as another demo user to explore seeded data."
            />
          ) : (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.02]">
              <HomeWorkDashboard
                user={user}
                visibleCases={visibleCases}
                statusBarLinkTarget={canViewReports(user) ? "reports" : "cases"}
              />
            </section>
          )}

          <footer className="text-xs text-slate-500">
            Port may differ (for example <code className="font-mono">3001</code>); use the URL printed in the terminal.
          </footer>
        </div>
      </DashboardShell>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-sky-900 via-sky-600 to-sky-700" aria-hidden />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <CiscoBrandLogo className="h-9 w-auto max-w-[6rem] object-contain object-left" />
            <div className="min-w-0 border-slate-200 sm:border-l sm:pl-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">EoX Workflow Management Platform</p>
              <p className="mt-0.5 text-xs text-slate-600">EoVSS / EoSM / ESS/MSS · Internal demo · Local sign-in</p>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Demo workspace</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Pick a seeded demo user below, then open cases and intake. Password for seeded accounts after{" "}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-xs ring-1 ring-slate-200">npm run db:seed</code>:{" "}
              <strong className="font-medium text-slate-800">Demo123!</strong>
            </p>
          </div>
        </header>

        {loginErr === "invalid" ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            Invalid email or password.
          </p>
        ) : null}
        {loginErr === "config" ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Set <code className="font-mono text-xs">SESSION_SECRET</code> in <code className="font-mono text-xs">.env</code>{" "}
            to at least 32 characters (see <code className="font-mono text-xs">.env.example</code>), then restart{" "}
            <code className="font-mono text-xs">npm run dev</code>.
          </p>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.02]">
          <div className="h-0.5 bg-sky-700" aria-hidden />
          <div className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Demo sign-in</h2>
            <p className="mt-1 text-xs text-slate-500">HttpOnly session cookie; local demo only.</p>
            <form action={demoLoginAction} className="mt-4 flex flex-col gap-3">
              <label className="block text-sm">
                <span className="text-slate-700">User</span>
                <select
                  name="email"
                  required
                  className="mt-1 w-full max-w-xl rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
                  defaultValue="cx.primary@local"
                >
                  {DEMO_LOGIN_ACCOUNTS.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.label} — {u.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Demo123!"
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
              </label>
              <button
                type="submit"
                className="w-fit rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-800"
              >
                Sign in
              </button>
            </form>
          </div>
        </section>

        <footer className="text-xs text-slate-500">
          Port may differ (for example <code className="font-mono">3001</code>); use the URL printed in the terminal.
        </footer>
      </div>
    </div>
  );
}
