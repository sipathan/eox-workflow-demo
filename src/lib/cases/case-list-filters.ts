import { CaseStatus } from "@prisma/client";

const CASE_STATUSES = new Set<string>(Object.values(CaseStatus));

/** Validate `?status=` on `/cases` against Prisma `CaseStatus` values. */
export function parseCaseListStatusParam(raw: string | undefined): CaseStatus | null {
  if (raw == null || raw === "") return null;
  const v = decodeURIComponent(raw.trim());
  return CASE_STATUSES.has(v) ? (v as CaseStatus) : null;
}
