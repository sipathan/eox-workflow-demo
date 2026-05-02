import type { SessionUser } from "@/lib/auth/session";
import { canCreateRequest, canViewReports } from "@/lib/rbac";

export type PrimaryNavItem = {
  href: string;
  /** Short label shown in the left nav (aligned with PROJECT_CONTEXT / existing UI copy). */
  label: string;
  visible: (user: SessionUser) => boolean;
  /** Whether `pathname` (from `usePathname()`, no trailing slash) should highlight this item. */
  isActive: (pathname: string) => boolean;
};

/**
 * Single source of truth for primary left navigation order:
 * Home → Cases → Create request (if allowed) → Reports (if allowed).
 */
export function getPrimaryNavItems(): PrimaryNavItem[] {
  return [
    {
      href: "/",
      label: "Home",
      visible: () => true,
      isActive: (pathname) => pathname === "/" || pathname === "",
    },
    {
      href: "/cases",
      label: "Cases",
      visible: () => true,
      isActive: (pathname) => {
        if (pathname === "/cases") return true;
        if (pathname.startsWith("/cases/new")) return false;
        return /^\/cases\/[^/]+$/.test(pathname);
      },
    },
    {
      href: "/cases/new",
      label: "Create request",
      visible: (user) => canCreateRequest(user),
      isActive: (pathname) => pathname.startsWith("/cases/new"),
    },
    {
      href: "/reports",
      label: "Reports",
      visible: (user) => canViewReports(user),
      isActive: (pathname) => pathname.startsWith("/reports"),
    },
  ];
}
