import { CaseStatus, RequestType } from "@prisma/client";
import type { CaseReportsRow } from "@/lib/cases/queries";

export type ReportsFilterState = {
  requestType: "all" | RequestType;
  status: "all" | CaseStatus;
  /** Case routing owner (`Case.ownerId`). `__unassigned__` = ownerId is null. */
  ownerId: "all" | "__unassigned__" | string;
  /** Inclusive UTC start of day from `YYYY-MM-DD`; filters on `Case.createdAt`. */
  dateFrom: string | null;
  /** Inclusive UTC end of day from `YYYY-MM-DD`. */
  dateTo: string | null;
};

export const REPORTS_FILTER_DEFAULTS: ReportsFilterState = {
  requestType: "all",
  status: "all",
  ownerId: "all",
  dateFrom: null,
  dateTo: null,
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function dayStartUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dayEndUtc(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

const REQUEST_TYPES = new Set<string>(Object.values(RequestType));
const CASE_STATUSES = new Set<string>(Object.values(CaseStatus));

export function parseReportsFilters(
  params: Record<string, string | string[] | undefined>
): ReportsFilterState {
  const rtRaw =
    firstParam(params.requestType) ?? firstParam(params.svc) ?? firstParam(params.service);
  /** Legacy bookmarks used `EoSS`; DB enum is `ESS_MSS`. */
  const rt = rtRaw === "EoSS" ? RequestType.ESS_MSS : rtRaw;
  const requestType =
    rt && REQUEST_TYPES.has(rt) ? (rt as RequestType) : REPORTS_FILTER_DEFAULTS.requestType;

  const st = firstParam(params.status);
  const status =
    st && CASE_STATUSES.has(st) ? (st as CaseStatus) : REPORTS_FILTER_DEFAULTS.status;

  const own = firstParam(params.ownerId) ?? firstParam(params.owner);
  let ownerId: ReportsFilterState["ownerId"] = REPORTS_FILTER_DEFAULTS.ownerId;
  if (own === "__unassigned__" || own === "none") ownerId = "__unassigned__";
  else if (own && own.length > 0 && own !== "all") ownerId = own;

  const from = firstParam(params.dateFrom) ?? firstParam(params.from);
  const to = firstParam(params.dateTo) ?? firstParam(params.to);
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : null;
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") ? to! : null;

  return { requestType, status, ownerId, dateFrom, dateTo };
}

export function filtersAreDefault(f: ReportsFilterState): boolean {
  return (
    f.requestType === "all" &&
    f.status === "all" &&
    f.ownerId === "all" &&
    f.dateFrom == null &&
    f.dateTo == null
  );
}

export function applyReportsFilters(rows: CaseReportsRow[], f: ReportsFilterState): CaseReportsRow[] {
  let out = rows;

  if (f.requestType !== "all") {
    out = out.filter((r) => r.requestType === f.requestType);
  }
  if (f.status !== "all") {
    out = out.filter((r) => r.status === f.status);
  }
  if (f.ownerId === "__unassigned__") {
    out = out.filter((r) => r.ownerId == null);
  } else if (f.ownerId !== "all") {
    out = out.filter((r) => r.ownerId === f.ownerId);
  }

  if (f.dateFrom) {
    const t0 = dayStartUtc(f.dateFrom);
    out = out.filter((r) => r.createdAt >= t0);
  }
  if (f.dateTo) {
    const t1 = dayEndUtc(f.dateTo);
    out = out.filter((r) => r.createdAt <= t1);
  }

  return out;
}

export type OwnerFilterOption = { id: string; name: string };

/** Distinct case owners from the full visible set (before filters), for the owner dropdown. */
export function ownerFilterOptions(rows: CaseReportsRow[]): OwnerFilterOption[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.ownerId && r.owner) {
      map.set(r.owner.id, r.owner.name);
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
