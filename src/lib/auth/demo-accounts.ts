/**
 * Seeded demo users allowed to sign in locally. Must stay in sync with `prisma/seed.ts` (10 users).
 * “Inactive” demo personas authenticate with empty portfolios (no seeded cases/tasks); all rows stay `isActive: true`.
 */
export const DEMO_LOGIN_ACCOUNTS = [
  { email: "cx.primary@local", label: "CX · Account · Platform admin" },
  { email: "cx.priya@local", label: "CX Operations" },
  { email: "cx.luis@local", label: "CX Operations" },
  { email: "cx.inactive@local", label: "CX (no seeded cases/tasks)" },
  { email: "sales.demo@local", label: "Account team" },
  { email: "account.maya@local", label: "Account team" },
  { email: "bu.demo@local", label: "BU contributor" },
  { email: "finance.demo@local", label: "Finance approver" },
  { email: "leader.demo@local", label: "Leadership (read-only)" },
  { email: "account.inactive@local", label: "Account (no seeded cases/tasks)" },
] as const;

const DEMO_LOGIN_EMAIL_SET = new Set(
  DEMO_LOGIN_ACCOUNTS.map((a) => a.email.toLowerCase())
);

export function isAllowedDemoLoginEmail(email: string): boolean {
  return DEMO_LOGIN_EMAIL_SET.has(email.trim().toLowerCase());
}
