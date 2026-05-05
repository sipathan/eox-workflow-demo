"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { demoLogoutAction } from "@/app/actions/auth";
import { CiscoBrandLogo } from "@/components/branding/CiscoBrandLogo";
import type { SessionUser } from "@/lib/auth/session";
import { getPrimaryNavItems } from "@/lib/navigation/app-nav";

type Props = {
  user: SessionUser;
};

const routeLinkBase =
  "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

export function DashboardSidebar({ user }: Props) {
  const pathname = usePathname() || "/";
  const items = getPrimaryNavItems().filter((item) => item.visible(user));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="h-1 shrink-0 bg-gradient-to-r from-sky-900 via-sky-600 to-sky-700" aria-hidden />
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="flex gap-2.5">
          <CiscoBrandLogo className="h-7 w-auto max-w-[4.25rem] shrink-0 object-contain object-left" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold leading-snug tracking-tight text-slate-900">
              EoX Workflow Management Platform
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-600">EoVSS / EoSM / ESS/MSS · Case management</p>
          </div>
        </div>
        <p className="mt-2.5 border-t border-slate-100 pt-2 text-[10px] leading-snug text-slate-500">
          Signed-in identity and roles are shown in the header →
        </p>
      </div>

      <div className="flex flex-col bg-slate-50/80 px-3 py-4">
        <nav className="flex flex-col gap-1" aria-label="Primary">
          {items.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${routeLinkBase} ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-800 hover:bg-slate-200/90 hover:text-slate-900"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="my-3 border-t border-slate-200/90" aria-hidden="true" />

        <form action={demoLogoutAction}>
          <button
            type="submit"
            className={`${routeLinkBase} w-full text-left text-slate-600 hover:bg-slate-200/80 hover:text-slate-900`}
            aria-label="Sign out of demo session"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
