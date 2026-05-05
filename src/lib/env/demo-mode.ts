/**
 * Demo-only features (persona switcher, etc.) gate on exact string `"true"`.
 * Unset or any other value disables them — no weakening of normal auth paths.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
