import type { RoleKey } from "@prisma/client";

/** Human-readable role names for headers and reviewer-facing UI. */
export const ROLE_LABELS: Record<RoleKey, string> = {
  ACCOUNT_TEAM: "Account Team",
  CX_OPS: "CX Operations",
  BU_CONTRIBUTOR: "BU Contributor",
  FINANCE_APPROVER: "Finance Approver",
  LEADERSHIP_READONLY: "Leadership (read-only)",
  PLATFORM_ADMIN: "Platform Admin",
};

export function formatRoleLabels(roles: RoleKey[]): string[] {
  return [...roles].sort((a, b) => ROLE_LABELS[a].localeCompare(ROLE_LABELS[b])).map((k) => ROLE_LABELS[k]);
}
