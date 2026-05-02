import { CaseStatus, QuoteBookingStatus, RequestType, TaskStatus, TaskType } from "@prisma/client";
import type { CaseReportsRow } from "@/lib/cases/queries";
import { rollupCaseFinancials, roundMoney2 } from "@/lib/cases/financials";
import type { SessionUser } from "@/lib/auth/session";
import { listCasesForReports } from "@/lib/cases/queries";
import {
  applyReportsFilters,
  ownerFilterOptions,
  type OwnerFilterOption,
  type ReportsFilterState,
} from "@/lib/reports/reports-filters";

const MS_PER_DAY = 86_400_000;

const TERMINAL: ReadonlySet<CaseStatus> = new Set([
  CaseStatus.Closed,
  CaseStatus.Rejected,
  CaseStatus.Cancelled,
]);

/** Active pipeline: any case that is not in a terminal workflow outcome (includes Draft). */
function isActivePipelineStatus(status: CaseStatus): boolean {
  return !TERMINAL.has(status);
}

function financialsForCase(row: CaseReportsRow) {
  return rollupCaseFinancials(row.assets.map((a) => ({ buCost: a.buCost, cxCost: a.cxCost })));
}

function cycleDays(createdAt: Date, endAt: Date): number {
  const raw = (endAt.getTime() - createdAt.getTime()) / MS_PER_DAY;
  return Math.max(0, raw);
}

function monthKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return roundMoney2(sum / nums.length);
}

export type ServiceMetricsBlock = {
  requestType: RequestType;
  caseCount: number;
  activeCases: number;
  closedCases: number;
  totalQuoteValue: number;
  totalBuCost: number;
  totalCxCost: number;
  /** `totalQuoteValue / caseCount` when caseCount > 0, else 0. */
  averageQuoteValue: number;
  /** Mean cycle days for `Closed` cases in this segment; null if none. */
  averageCycleDaysClosed: number | null;
};

export type LostReasonBucket = {
  reasonLabel: string;
  count: number;
};

export type MonthClosedRow = {
  monthKey: string;
  closedCount: number;
  averageCycleDays: number | null;
};

export type ReportsDashboardModel = {
  executive: {
    totalCases: number;
    activeCases: number;
    closedCases: number;
    averageCycleDays: number | null;
    totalQuoteValue: number;
  };
  overallFinancial: {
    totalQuoteValue: number;
    totalBuCost: number;
    totalCxCost: number;
    averageQuoteValue: number;
  };
  byService: ServiceMetricsBlock[];
  monthlyClosed: MonthClosedRow[];
  lostOpportunity: {
    notBookedCount: number;
    passedOverCount: number;
    totalLostCount: number;
    byReason: LostReasonBucket[];
  };
  /**
   * There is no `closedAt` on `Case`. Cycle time and “closed per month” use
   * `updatedAt` as a stand-in end timestamp for rows with `status === Closed`.
   */
  cycleTimeAssumption: string;
};

/** Service segmentation order for dashboards: EoVSS, EoSM, ESS/MSS (`ESS_MSS` in Prisma). */
const REQUEST_ORDER: RequestType[] = [RequestType.EoVSS, RequestType.EoSM, RequestType.ESS_MSS];

function finalizeServiceBlock(
  rt: RequestType,
  acc: {
    caseCount: number;
    active: number;
    closed: number;
    quote: number;
    bu: number;
    cx: number;
    closedCycleDays: number[];
  }
): ServiceMetricsBlock {
  const avgQuote = acc.caseCount > 0 ? roundMoney2(acc.quote / acc.caseCount) : 0;
  return {
    requestType: rt,
    caseCount: acc.caseCount,
    activeCases: acc.active,
    closedCases: acc.closed,
    totalQuoteValue: roundMoney2(acc.quote),
    totalBuCost: roundMoney2(acc.bu),
    totalCxCost: roundMoney2(acc.cx),
    averageQuoteValue: avgQuote,
    averageCycleDaysClosed: average(acc.closedCycleDays),
  };
}

export function buildReportsDashboard(rows: CaseReportsRow[]): ReportsDashboardModel {
  const totalCases = rows.length;
  let activeCases = 0;
  let closedCases = 0;
  let totalQuoteValue = 0;
  let totalBuCost = 0;
  let totalCxCost = 0;
  const allClosedCycleDays: number[] = [];

  const byRt = new Map<
    RequestType,
    {
      caseCount: number;
      active: number;
      closed: number;
      quote: number;
      bu: number;
      cx: number;
      closedCycleDays: number[];
    }
  >();

  for (const rt of REQUEST_ORDER) {
    byRt.set(rt, { caseCount: 0, active: 0, closed: 0, quote: 0, bu: 0, cx: 0, closedCycleDays: [] });
  }

  const monthMap = new Map<string, { closedCount: number; cycleDays: number[] }>();
  let notBookedCount = 0;
  let passedOverCount = 0;
  const reasonCounts = new Map<string, number>();

  for (const row of rows) {
    const fin = financialsForCase(row);
    totalQuoteValue += fin.totalQuoteValue;
    totalBuCost += fin.totalBuCost;
    totalCxCost += fin.totalCxCost;

    if (isActivePipelineStatus(row.status)) activeCases += 1;
    if (row.status === CaseStatus.Closed) {
      closedCases += 1;
      const days = cycleDays(row.createdAt, row.updatedAt);
      allClosedCycleDays.push(days);

      const mk = monthKeyUtc(row.updatedAt);
      const bucket = monthMap.get(mk) ?? { closedCount: 0, cycleDays: [] };
      bucket.closedCount += 1;
      bucket.cycleDays.push(days);
      monthMap.set(mk, bucket);
    }

    const seg = byRt.get(row.requestType);
    if (seg) {
      seg.caseCount += 1;
      if (isActivePipelineStatus(row.status)) seg.active += 1;
      if (row.status === CaseStatus.Closed) {
        seg.closed += 1;
        seg.closedCycleDays.push(cycleDays(row.createdAt, row.updatedAt));
      }
      seg.quote += fin.totalQuoteValue;
      seg.bu += fin.totalBuCost;
      seg.cx += fin.totalCxCost;
    }

    if (row.quoteBookingStatus === QuoteBookingStatus.NOT_BOOKED) {
      notBookedCount += 1;
    } else if (row.quoteBookingStatus === QuoteBookingStatus.PASSED_OVER) {
      passedOverCount += 1;
    }

    if (
      row.quoteBookingStatus === QuoteBookingStatus.NOT_BOOKED ||
      row.quoteBookingStatus === QuoteBookingStatus.PASSED_OVER
    ) {
      const raw = (row.notBookedReason ?? "").trim();
      const label = raw.length > 0 ? raw : "— (no reason recorded)";
      reasonCounts.set(label, (reasonCounts.get(label) ?? 0) + 1);
    }
  }

  totalQuoteValue = roundMoney2(totalQuoteValue);
  totalBuCost = roundMoney2(totalBuCost);
  totalCxCost = roundMoney2(totalCxCost);

  const monthlyClosed: MonthClosedRow[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, v]) => ({
      monthKey,
      closedCount: v.closedCount,
      averageCycleDays: average(v.cycleDays),
    }));

  const byReason: LostReasonBucket[] = [...reasonCounts.entries()]
    .map(([reasonLabel, count]) => ({ reasonLabel, count }))
    .sort((a, b) => b.count - a.count || a.reasonLabel.localeCompare(b.reasonLabel));

  const byService = REQUEST_ORDER.map((rt) => finalizeServiceBlock(rt, byRt.get(rt)!));

  return {
    executive: {
      totalCases,
      activeCases,
      closedCases,
      averageCycleDays: average(allClosedCycleDays),
      totalQuoteValue,
    },
    overallFinancial: {
      totalQuoteValue,
      totalBuCost,
      totalCxCost,
      averageQuoteValue: totalCases > 0 ? roundMoney2(totalQuoteValue / totalCases) : 0,
    },
    byService,
    monthlyClosed,
    lostOpportunity: {
      notBookedCount,
      passedOverCount,
      totalLostCount: notBookedCount + passedOverCount,
      byReason,
    },
    cycleTimeAssumption:
      "Average cycle time uses createdAt → updatedAt for cases in Closed status only. " +
      "There is no dedicated closedAt field; updatedAt is treated as the close snapshot for throughput by month.",
  };
}

export async function getReportsDashboardForUser(user: SessionUser): Promise<ReportsDashboardModel> {
  const rows = await listCasesForReports(user);
  return buildReportsDashboard(rows);
}

// --- Extended reporting: bottlenecks, aging, time series (same filtered row set as KPIs) ---

/** Open runnable tasks in the “upstream commercial / scope” queue before quote (BU ladder or ESS/MSS eligibility). */
const BU_TASK_TYPES = new Set<TaskType>([
  TaskType.BUReview,
  TaskType.BUPricing,
  TaskType.EligibilityReview,
]);

function isOpenRunnableTask(t: { isRunnable: boolean; status: TaskStatus }): boolean {
  if (!t.isRunnable) return false;
  return t.status !== TaskStatus.Completed && t.status !== TaskStatus.NotRequired;
}

function distinctCaseCountForTaskTypes(rows: CaseReportsRow[], types: Set<TaskType>): number {
  let n = 0;
  for (const r of rows) {
    const hit = r.tasks.some((t) => types.has(t.type) && isOpenRunnableTask(t));
    if (hit) n += 1;
  }
  return n;
}

export type ReportsBottleneckModel = {
  casesByStatus: { status: CaseStatus; count: number }[];
  /** Cases with `Case.status === Blocked`. */
  blockedCaseCount: number;
  /** Distinct cases with at least one runnable open BU Review, BU Pricing, or Eligibility Review task. */
  awaitingBuCaseCount: number;
  awaitingVapCaseCount: number;
  awaitingFlagRemovalCaseCount: number;
  /** Largest count among blocked + the three awaiting signals (ties broken: Blocked → BU → VAP → Flag). */
  topBottleneck: { label: string; count: number } | null;
};

export function buildBottleneckModel(rows: CaseReportsRow[]): ReportsBottleneckModel {
  const statusCounts = new Map<CaseStatus, number>();
  for (const s of Object.values(CaseStatus)) {
    statusCounts.set(s, 0);
  }
  let blockedCaseCount = 0;
  for (const r of rows) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
    if (r.status === CaseStatus.Blocked) blockedCaseCount += 1;
  }
  const casesByStatus = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));

  const awaitingBuCaseCount = distinctCaseCountForTaskTypes(rows, BU_TASK_TYPES);
  const awaitingVapCaseCount = distinctCaseCountForTaskTypes(rows, new Set([TaskType.VAPTracking]));
  const awaitingFlagRemovalCaseCount = distinctCaseCountForTaskTypes(
    rows,
    new Set([TaskType.FlagRemovalTracking])
  );

  const candidates: { label: string; count: number }[] = [
    { label: "Case status: Blocked", count: blockedCaseCount },
    {
      label: "Awaiting BU / eligibility (open runnable BU review, pricing, or eligibility review)",
      count: awaitingBuCaseCount,
    },
    { label: "Awaiting VAP (open runnable VAP tracking)", count: awaitingVapCaseCount },
    { label: "Awaiting flag removal (open runnable flag task)", count: awaitingFlagRemovalCaseCount },
  ];
  const nonZero = candidates.filter((c) => c.count > 0);
  let topBottleneck: ReportsBottleneckModel["topBottleneck"] = null;
  if (nonZero.length > 0) {
    const best = nonZero.reduce((a, b) => (b.count > a.count ? b : a));
    topBottleneck = { label: best.label, count: best.count };
  }

  return {
    casesByStatus,
    blockedCaseCount,
    awaitingBuCaseCount,
    awaitingVapCaseCount,
    awaitingFlagRemovalCaseCount,
    topBottleneck,
  };
}

export type CaseStatusAgingRow = {
  status: CaseStatus;
  caseCount: number;
  /** See `caseStatusAgingAssumption` on payload. */
  averageDays: number | null;
};

export type TaskAgingRow = {
  taskType: TaskType;
  openRunnableTaskCount: number;
  averageAgeDays: number | null;
};

const TASK_AGING_TYPES: TaskType[] = [
  TaskType.BUReview,
  TaskType.BUPricing,
  TaskType.EligibilityReview,
  TaskType.VAPTracking,
  TaskType.FlagRemovalTracking,
  TaskType.QuoteTracking,
  TaskType.IntakeValidation,
];

function taskAgeDays(
  t: { activatedAt: Date | null; createdAt: Date },
  asOf: Date
): number {
  const start = t.activatedAt ?? t.createdAt;
  return cycleDays(start, asOf);
}

export function buildCaseStatusAging(rows: CaseReportsRow[], asOf: Date): CaseStatusAgingRow[] {
  const bucket = new Map<CaseStatus, number[]>();
  for (const s of Object.values(CaseStatus)) {
    bucket.set(s, []);
  }
  for (const r of rows) {
    const end = TERMINAL.has(r.status) ? r.updatedAt : asOf;
    const days = cycleDays(r.createdAt, end);
    bucket.get(r.status)!.push(days);
  }
  return Object.values(CaseStatus)
    .map((status) => {
      const ages = bucket.get(status)!;
      const caseCount = ages.length;
      return {
        status,
        caseCount,
        averageDays: average(ages),
      };
    })
    .filter((x) => x.caseCount > 0)
    .sort((a, b) => b.caseCount - a.caseCount || a.status.localeCompare(b.status));
}

export function buildTaskAging(rows: CaseReportsRow[], asOf: Date): TaskAgingRow[] {
  const byType = new Map<TaskType, number[]>();
  for (const tt of TASK_AGING_TYPES) {
    byType.set(tt, []);
  }
  for (const r of rows) {
    for (const t of r.tasks) {
      if (!isOpenRunnableTask(t)) continue;
      const arr = byType.get(t.type);
      if (!arr) continue;
      arr.push(taskAgeDays(t, asOf));
    }
  }
  return TASK_AGING_TYPES.map((taskType) => {
    const ages = byType.get(taskType)!;
    const openRunnableTaskCount = ages.length;
    return {
      taskType,
      openRunnableTaskCount,
      averageAgeDays: average(ages),
    };
  }).filter((x) => x.openRunnableTaskCount > 0);
}

export type TimeSeriesMonthRow = {
  monthKey: string;
  casesCreated: number;
  revenueQuoteValue: number;
  casesClosed: number;
};

export function buildTimeSeries(rows: CaseReportsRow[]): TimeSeriesMonthRow[] {
  const created = new Map<string, { n: number; rev: number }>();
  const closed = new Map<string, number>();

  for (const r of rows) {
    const cm = monthKeyUtc(r.createdAt);
    const c = created.get(cm) ?? { n: 0, rev: 0 };
    c.n += 1;
    c.rev += financialsForCase(r).totalQuoteValue;
    created.set(cm, c);

    if (r.status === CaseStatus.Closed) {
      const xm = monthKeyUtc(r.updatedAt);
      closed.set(xm, (closed.get(xm) ?? 0) + 1);
    }
  }

  const keys = new Set([...created.keys(), ...closed.keys()]);
  const sorted = [...keys].sort((a, b) => a.localeCompare(b));
  return sorted.map((monthKey) => {
    const cr = created.get(monthKey);
    return {
      monthKey,
      casesCreated: cr?.n ?? 0,
      revenueQuoteValue: roundMoney2(cr?.rev ?? 0),
      casesClosed: closed.get(monthKey) ?? 0,
    };
  });
}

export type ReportsPagePayload = {
  dashboard: ReportsDashboardModel;
  bottlenecks: ReportsBottleneckModel;
  caseStatusAging: CaseStatusAgingRow[];
  taskAging: TaskAgingRow[];
  timeSeries: TimeSeriesMonthRow[];
  caseStatusAgingAssumption: string;
  taskAgingAssumption: string;
  dateFilterAssumption: string;
};

export type ReportsPageData = ReportsPagePayload & {
  ownerOptions: OwnerFilterOption[];
  appliedFilters: ReportsFilterState;
  unfilteredVisibleCount: number;
  filteredCount: number;
};

export function buildReportsPagePayload(rows: CaseReportsRow[], asOf: Date): ReportsPagePayload {
  const taskAgingRaw = buildTaskAging(rows, asOf);
  return {
    dashboard: buildReportsDashboard(rows),
    bottlenecks: buildBottleneckModel(rows),
    caseStatusAging: buildCaseStatusAging(rows, asOf),
    taskAging: taskAgingRaw,
    timeSeries: buildTimeSeries(rows),
    caseStatusAgingAssumption:
      "Per current status: for terminal outcomes (Closed / Rejected / Cancelled), age = updatedAt − createdAt " +
      "(lifecycle proxy). For all other statuses, age = report run time − createdAt (how long cases have sat in that status cohort).",
    taskAgingAssumption:
      "Task aging counts only runnable tasks that are not Completed or Not Required. Age = now − activatedAt when set, " +
      "otherwise now − task createdAt (aligns with “days active” when activated).",
    dateFilterAssumption:
      "When set, the date range filters cases by Case.createdAt (UTC day bounds). All KPIs, bottlenecks, aging, and " +
      "time series use that same filtered cohort.",
  };
}

export async function getReportsPageData(
  user: SessionUser,
  filters: ReportsFilterState
): Promise<ReportsPageData> {
  const all = await listCasesForReports(user);
  const ownerOptions = ownerFilterOptions(all);
  const filtered = applyReportsFilters(all, filters);
  const asOf = new Date();
  const payload = buildReportsPagePayload(filtered, asOf);
  return {
    ...payload,
    ownerOptions,
    appliedFilters: filters,
    unfilteredVisibleCount: all.length,
    filteredCount: filtered.length,
  };
}
