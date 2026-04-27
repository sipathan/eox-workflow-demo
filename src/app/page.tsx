import Link from "next/link";
import { demoLoginAction, demoLogoutAction } from "@/app/actions/auth";
import { getSessionUser } from "@/lib/auth/session";

const DEMO_USERS = [
  { email: "sales.demo@local", label: "Account team" },
  { email: "cx.demo@local", label: "CX Ops" },
  { email: "bu.demo@local", label: "BU contributor" },
  { email: "finance.demo@local", label: "Finance approver" },
  { email: "leader.demo@local", label: "Leadership (read-only)" },
  { email: "admin.demo@local", label: "Platform admin" },
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const sp = await searchParams;
  const loginErr = sp.login;
  const user = await getSessionUser();

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">EoX Workflow</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Demo workspace</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          This is the EoX workflow demo app (not the generic Next.js starter). Pick a seeded demo user below,
          then open cases and intake. Password for seeded accounts after{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">npm run db:seed</code>:{" "}
          <strong className="font-medium text-slate-800">Demo123!</strong>
        </p>
      </header>

      {loginErr === "invalid" ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          Unknown or inactive demo email.
        </p>
      ) : null}
      {loginErr === "config" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Set <code className="font-mono text-xs">SESSION_SECRET</code> in <code className="font-mono text-xs">.env</code>{" "}
          to at least 32 characters (see <code className="font-mono text-xs">.env.example</code>), then restart{" "}
          <code className="font-mono text-xs">npm run dev</code>.
        </p>
      ) : null}

      {user ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            Signed in as <span className="font-medium text-slate-900">{user.name}</span>{" "}
            <span className="text-slate-500">({user.email})</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/cases"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Cases
            </Link>
            <Link
              href="/cases/new"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              New request
            </Link>
            <form action={demoLogoutAction}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Demo sign-in</h2>
          <p className="mt-1 text-xs text-slate-500">HttpOnly session cookie; local demo only.</p>
          <form action={demoLoginAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm">
              <span className="text-slate-700">User</span>
              <select
                name="email"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"
                defaultValue="cx.demo@local"
              >
                {DEMO_USERS.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.label} — {u.email}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
            >
              Continue
            </button>
          </form>
        </section>
      )}

      <footer className="text-xs text-slate-500">
        Port may differ (for example <code className="font-mono">3001</code>); use the URL printed in the terminal.
      </footer>
    </div>
  );
}
