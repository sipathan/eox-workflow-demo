/**
 * Demo seed: roles, teams, users (multi-role on cx.demo@local), 14 cases, tasks, refs, activity, comments.
 * Password for all users: Demo123! (bcrypt).
 */
import {
  PrismaClient,
  RoleKey,
  TeamType,
  CaseStatus,
  RequestType,
  Priority,
  TaskType,
  TaskStatus,
  ExternalReferenceType,
  QuoteBookingStatus,
  EssMssSupportSubtype,
} from "@prisma/client";
import {
  ESS_MSS_ELIGIBILITY_NOTE_HARDWARE,
  ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE,
} from "../src/lib/workflow/task-templates";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo123!";

const ROLE_DISPLAY: Record<RoleKey, string> = {
  ACCOUNT_TEAM: "Account Team",
  CX_OPS: "CX Operations",
  BU_CONTRIBUTOR: "BU Contributor",
  FINANCE_APPROVER: "Finance Approver",
  LEADERSHIP_READONLY: "Leadership Readonly",
  PLATFORM_ADMIN: "Platform Admin",
};

async function main(): Promise<void> {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12);

  await prisma.externalReference.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.case.deleteMany();
  await prisma.userTeam.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.role.deleteMany();

  const roleKeys: RoleKey[] = [
    RoleKey.ACCOUNT_TEAM,
    RoleKey.CX_OPS,
    RoleKey.BU_CONTRIBUTOR,
    RoleKey.FINANCE_APPROVER,
    RoleKey.LEADERSHIP_READONLY,
    RoleKey.PLATFORM_ADMIN,
  ];
  const roleRows = await prisma.$transaction(
    roleKeys.map((key) =>
      prisma.role.create({
        data: { key, name: ROLE_DISPLAY[key] },
      })
    )
  );
  const roleByKey = Object.fromEntries(roleRows.map((r) => [r.key, r])) as Record<RoleKey, (typeof roleRows)[0]>;

  const cxOpsTeam = await prisma.team.create({
    data: {
      name: "CX Ops Global",
      type: TeamType.CX_OPERATIONS,
      region: "Global",
      businessUnit: "CX",
    },
  });
  const buQueue = await prisma.team.create({
    data: {
      name: "BU Review Queue",
      type: TeamType.BU_QUEUE,
      region: "AMER",
      businessUnit: "BU",
    },
  });
  const financeTeam = await prisma.team.create({
    data: {
      name: "Finance Approvers",
      type: TeamType.FINANCE,
      region: "Global",
      businessUnit: "Finance",
    },
  });
  const leadershipTeam = await prisma.team.create({
    data: {
      name: "Leadership",
      type: TeamType.LEADERSHIP,
      region: null,
      businessUnit: null,
    },
  });
  const adminTeam = await prisma.team.create({
    data: {
      name: "Platform Admin",
      type: TeamType.PLATFORM_ADMIN,
      region: null,
      businessUnit: "IT",
    },
  });

  const sales = await prisma.user.create({
    data: {
      email: "sales.demo@local",
      name: "Alex Rivera (Account Team)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.ACCOUNT_TEAM.id }] },
    },
  });

  const cx = await prisma.user.create({
    data: {
      email: "cx.demo@local",
      name: "Jordan Lee (CX Ops + Account)",
      passwordHash,
      roles: {
        create: [{ roleId: roleByKey.CX_OPS.id }, { roleId: roleByKey.ACCOUNT_TEAM.id }],
      },
      teams: {
        create: [{ teamId: cxOpsTeam.id }, { teamId: buQueue.id }],
      },
    },
  });

  const bu = await prisma.user.create({
    data: {
      email: "bu.demo@local",
      name: "Sam Patel (BU Contributor)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.BU_CONTRIBUTOR.id }] },
      teams: { create: [{ teamId: buQueue.id }] },
    },
  });

  const finance = await prisma.user.create({
    data: {
      email: "finance.demo@local",
      name: "Taylor Kim (Finance Approver)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.FINANCE_APPROVER.id }] },
      teams: { create: [{ teamId: financeTeam.id }] },
    },
  });

  const leader = await prisma.user.create({
    data: {
      email: "leader.demo@local",
      name: "Morgan Chen (Leadership Readonly)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.LEADERSHIP_READONLY.id }] },
      teams: { create: [{ teamId: leadershipTeam.id }] },
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin.demo@local",
      name: "Riley Park (Platform Admin)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.PLATFORM_ADMIN.id }] },
      teams: {
        create: [
          { teamId: cxOpsTeam.id },
          { teamId: buQueue.id },
          { teamId: financeTeam.id },
          { teamId: leadershipTeam.id },
          { teamId: adminTeam.id },
        ],
      },
    },
  });

  type AssetSeed = {
    platformName: string;
    softwareVersion?: string | null;
    serialNumbers?: string | null;
    eolBulletinLink?: string | null;
    hwLdosDate?: Date | null;
    /** Optional units / count for this platform line (not case-wide). */
    quantity?: number | null;
    buCost?: number;
    cxCost?: number;
  };

  type TaskSeed = {
    type: TaskType;
    status: TaskStatus;
    /** Index into `assets` for per-platform tasks; omit for case-level tasks. */
    assetIndex?: number;
    ownerId?: string;
    assignedTeamId?: string;
    isRequired?: boolean;
    isRunnable?: boolean;
    activatedAt?: Date | null;
    notes?: string;
    blockerReason?: string;
    notRequiredReason?: string;
  };

  type CaseSeed = {
    caseId: string;
    requestType: RequestType;
    customer: string;
    dealId?: string | null;
    status: CaseStatus;
    priority: Priority;
    requesterId: string;
    ownerId?: string;
    assignedTeamId?: string;
    justification: string;
    migrationPlan?: string | null;
    essSupportSubtype?: EssMssSupportSubtype | null;
    migrationTimeline?: string | null;
    targetReplacementProduct?: string | null;
    hardwarePhysicalLocation?: string | null;
    softwareDeploymentType?: string | null;
    softwareProductFamily?: string | null;
    softwareOnPremise?: boolean | null;
    softwarePerpetualLicense?: boolean | null;
    softwareIsApplicationSoftware?: boolean | null;
    softwareNotIosIosXr?: boolean | null;
    environmentIsProduction?: boolean | null;
    essEligibilityAcknowledged?: boolean;
    partnerName?: string | null;
    quoteBookingStatus?: QuoteBookingStatus;
    notBookedReason?: string | null;
    /** Optional CX routing context; persisted on `Case.routingNote`. */
    routingNote?: string | null;
    assets: AssetSeed[];
    tasks: TaskSeed[];
    refs?: Array<{
      type: ExternalReferenceType;
      referenceId: string;
      externalStatus?: string;
      taskIndex?: number;
    }>;
  };

  const T0 = new Date("2026-01-08T12:00:00.000Z");
  const T1 = new Date("2026-01-09T09:00:00.000Z");
  const T2 = new Date("2026-01-10T15:00:00.000Z");

  const cases: CaseSeed[] = [
    {
      caseId: "EoVSS-2026-100001",
      requestType: RequestType.EoVSS,
      customer: "DeltaGrid Manufacturing Group",
      dealId: "DEAL-88421",
      routingNote: "Primary CX queue owner; customer asked for weekly checkpoints until quote.",
      status: CaseStatus.InProgress,
      priority: Priority.High,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Customer requires extended support bridge until hardware refresh.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "ASR 9000",
          softwareVersion: "7.5.2",
          serialNumbers: "SN-DG-9001\nSN-DG-9002",
          eolBulletinLink: "https://example.com/eol/asr9000",
          hwLdosDate: new Date("2027-06-30"),
          quantity: 2,
          buCost: 120_000,
          cxCost: 51_600,
        },
        {
          platformName: "ISR 4451",
          softwareVersion: "17.6.3a",
          serialNumbers: "SN-DG-4451",
          eolBulletinLink: "https://example.com/eol/isr4451",
          hwLdosDate: new Date("2026-12-31"),
          quantity: 1,
          buCost: 75_000,
          /** Intentionally not 43% of BU — demo shows manual CX uplift vs the suggestion-only model. */
          cxCost: 27_000,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: bu.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 1,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: bu.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 1,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
      refs: [
        { type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-2026-778812", externalStatus: "Submitted" },
        { type: ExternalReferenceType.VAP_ID, referenceId: "VAP-AMER-99231", externalStatus: "In review" },
      ],
    },
    {
      caseId: "EoSM-2026-100002",
      requestType: RequestType.EoSM,
      customer: "Summit Retail Holdings",
      dealId: "DEAL-77102",
      status: CaseStatus.Blocked,
      priority: Priority.Critical,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "EoSM coverage gap while APAS completes — tracking final software maintenance window.",
      migrationPlan:
        "EoSM context: last engineering maintenance release targeted for Q3; security fixes may follow EoVS/EoVSS policy.",
      quoteBookingStatus: QuoteBookingStatus.NOT_BOOKED,
      notBookedReason:
        "Customer paused renewal after pricing review — selected a competitor maintenance bundle instead.",
      assets: [{ platformName: "Catalyst 9300", softwareVersion: "17.9.4a", buCost: 42_000, cxCost: 18_060 }],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: bu.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Blocked,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          blockerReason: "Quote revision pending finance countersign.",
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
      refs: [
        { type: ExternalReferenceType.APAS_NPI, referenceId: "APAS-NPI-44102", externalStatus: "Open", taskIndex: 3 },
      ],
    },
    {
      caseId: "ESSMSS-2026-100003",
      requestType: RequestType.ESS_MSS,
      customer: "Northwind Global Logistics",
      dealId: "DEAL-66100",
      status: CaseStatus.ReadyForRelease,
      priority: Priority.Medium,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification:
        "ESS/MSS hardware-only: extend support beyond LDoS for Nexus switching at primary DC; physical site assessment complete.",
      essSupportSubtype: EssMssSupportSubtype.HARDWARE,
      migrationPlan:
        "Migration plan: staged RMA sparing for redundant supervisors week 12–14; cut traffic to secondary pair before decommission; rollback window 48h; CX war-room on cut weekend. Customer sign-off on maintenance freeze through Q3.",
      migrationTimeline: "Hardware cut: 2026-08-15 → 2026-08-22 (maintenance windows Sat 02:00–06:00 local).",
      targetReplacementProduct: "Catalyst 9500 high-availability pair (evaluation PO pending).",
      hardwarePhysicalLocation:
        "Northwind DC3 — 1200 Industrial Parkway, Chicago IL 60616, USA (assessed cage B12, rows 4–5).",
      softwareOnPremise: null,
      softwarePerpetualLicense: null,
      softwareIsApplicationSoftware: null,
      softwareNotIosIosXr: null,
      environmentIsProduction: true,
      essEligibilityAcknowledged: false,
      partnerName: null,
      quoteBookingStatus: QuoteBookingStatus.BOOKED,
      assets: [
        {
          platformName: "Nexus 9000",
          softwareVersion: "10.2(4)",
          serialNumbers: "NW-N9K-DC3-A1\nNW-N9K-DC3-A2",
          hwLdosDate: new Date("2026-09-30"),
          quantity: 2,
          buCost: 89_000,
          cxCost: 38_270,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_HARDWARE,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
      refs: [{ type: ExternalReferenceType.VAP_ID, referenceId: "VAP-EMEA-11002", externalStatus: "Approved" }],
    },
    {
      caseId: "EoVSS-2026-100004",
      requestType: RequestType.EoVSS,
      customer: "Adventure Works Distribution",
      dealId: null,
      status: CaseStatus.InReview,
      priority: Priority.Low,
      requesterId: sales.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Serial-level validation requested by customer procurement.",
      quoteBookingStatus: QuoteBookingStatus.PASSED_OVER,
      notBookedReason:
        "Partner-led renewal through matrix agreement — central quote team not engaged on this opportunity.",
      assets: [
        {
          platformName: "ISR 4451",
          softwareVersion: "17.6.3a",
          serialNumbers: "SN-AW-001",
          hwLdosDate: new Date("2026-11-15"),
          buCost: 15_000,
          cxCost: 6450,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
    },
    {
      caseId: "EoSM-2026-100005",
      requestType: RequestType.EoSM,
      customer: "Litware Financial Services",
      dealId: "DEAL-44090",
      status: CaseStatus.AwaitingInfo,
      priority: Priority.Medium,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "EoSM request pending additional LDOS and maintenance-end evidence from requester.",
      migrationPlan:
        "Optional notes: software maintenance ends FY27 Q1; customer documenting last patch train and support handoff.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [{ platformName: "Meraki MS425", softwareVersion: "16.16", buCost: 25_600, cxCost: 11_008 }],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: bu.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.InProgress,
          isRequired: true,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          notes: "Requester to upload LDOS evidence and any EoSM timing notes (supporting details optional).",
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
    },
    {
      caseId: "ESSMSS-2026-100006",
      requestType: RequestType.ESS_MSS,
      customer: "Wide World Importers Group",
      dealId: "DEAL-33900",
      status: CaseStatus.Closed,
      priority: Priority.Low,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification:
        "ESS/MSS software-only: perpetual on-prem application stack beyond vendor LDoS — partner-led renewal with Fabrikam.",
      essSupportSubtype: EssMssSupportSubtype.SOFTWARE,
      migrationPlan:
        "Migration plan: lift legacy ERP connector VMs to supported patch train; freeze schema changes 30 days; dual-write validation with finance batch jobs; rollback via snapshot restore. Customer CAB approved 2026-01-20.",
      migrationTimeline: "Code freeze through 2026-07-01; production cutover weekend 2026-07-12.",
      targetReplacementProduct: "Cisco-supported extended build for connector tier (SKU under FAB matrix).",
      softwareDeploymentType: "On-prem VMware cluster (3-node) — production tier only.",
      softwareProductFamily: "Custom Java ERP connector (non IOS/IOS-XR).",
      softwareOnPremise: true,
      softwarePerpetualLicense: true,
      softwareIsApplicationSoftware: true,
      softwareNotIosIosXr: true,
      environmentIsProduction: true,
      essEligibilityAcknowledged: false,
      partnerName: "Fabrikam Extended Support",
      quoteBookingStatus: QuoteBookingStatus.BOOKED,
      assets: [
        { platformName: "UCS C220", softwareVersion: "4.2(1f)", quantity: 120, buCost: 21_000, cxCost: 9030 },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotRequired,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          notRequiredReason: "No post-booking flag for this renewal path.",
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
    },
    {
      caseId: "EoVSS-2026-100007",
      requestType: RequestType.EoVSS,
      customer: "Tailspin Aerospace Systems",
      dealId: "DEAL-22881",
      status: CaseStatus.Submitted,
      priority: Priority.High,
      requesterId: sales.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Accelerated EoVSS for renewal alignment.",
      assets: [
        {
          platformName: "ASR 1001-X",
          softwareVersion: "17.3.4a",
          serialNumbers: "SN-TS-1001",
          hwLdosDate: new Date("2026-08-01"),
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.NotStarted,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
      refs: [{ type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-2026-661200", externalStatus: "Draft" }],
    },
    {
      caseId: "EoSM-2026-100008",
      requestType: RequestType.EoSM,
      customer: "Blue Yonder Air Cargo",
      dealId: "DEAL-11920",
      status: CaseStatus.Rejected,
      priority: Priority.Medium,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Originally requested EoSM; rejected after policy review.",
      migrationPlan: "Optional audit note: maintenance-end narrative captured for records only.",
      assets: [{ platformName: "Catalyst 9500", softwareVersion: "17.12.1" }],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
    },
    {
      caseId: "ESSMSS-2026-100009",
      requestType: RequestType.ESS_MSS,
      customer: "Fourth Coffee Roasters",
      dealId: "DEAL-99001",
      status: CaseStatus.Cancelled,
      priority: Priority.Low,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification:
        "ESS/MSS software path for lab ISR validation — cancelled when customer consolidated vendors (shows lab / non-production review signals).",
      essSupportSubtype: EssMssSupportSubtype.SOFTWARE,
      migrationPlan:
        "Migration plan (lab): mirror production route policy on isolated VRF; snapshot configs nightly; decommission lab after parity sign-off. Deal cancelled before execution — retained for eligibility demo.",
      migrationTimeline: "Lab window was 2026-05-01 → 2026-05-30 (cancelled mid-cycle).",
      targetReplacementProduct: "None — evaluation only.",
      softwareDeploymentType: "Bare-metal lab rack (non-production).",
      softwareProductFamily: "IOS-XE routing (lab parity with production ASR profile).",
      softwareOnPremise: true,
      softwarePerpetualLicense: true,
      softwareIsApplicationSoftware: false,
      softwareNotIosIosXr: false,
      environmentIsProduction: false,
      essEligibilityAcknowledged: true,
      partnerName: null,
      assets: [{ platformName: "ISR 4331", softwareVersion: "16.12.5" }],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
    },
    {
      caseId: "EoVSS-2026-100010",
      requestType: RequestType.EoVSS,
      customer: "Alpine Energy Networks",
      dealId: "DEAL-10293",
      status: CaseStatus.InProgress,
      priority: Priority.Critical,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "EoVSS with finance approval dependency.",
      assets: [
        {
          platformName: "Nexus 7700",
          softwareVersion: "8.4(5)",
          serialNumbers: "SN-AL-7701",
          hwLdosDate: new Date("2027-01-31"),
        },
        { platformName: "Nexus 7700", softwareVersion: "8.4(5)", serialNumbers: "SN-AL-7702", hwLdosDate: new Date("2027-01-31") },
        { platformName: "ASR 9001", softwareVersion: "24.2.1", serialNumbers: "SN-AL-9001", hwLdosDate: new Date("2028-03-01") },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: bu.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 1,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: bu.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 2,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: bu.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 1,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 2,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: finance.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
      refs: [{ type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-2026-889001", externalStatus: "Finance hold" }],
    },
    {
      caseId: "EoSM-2026-100011",
      requestType: RequestType.EoSM,
      customer: "Graphic Design Institute Network",
      dealId: null,
      status: CaseStatus.Draft,
      priority: Priority.Medium,
      requesterId: sales.id,
      justification: "Draft EoSM (End of Software Maintenance) intake — seller still gathering serials.",
      assets: [{ platformName: "Meraki MX250", softwareVersion: "18.107" }],
      tasks: [],
    },
    {
      caseId: "ESSMSS-2026-100012",
      requestType: RequestType.ESS_MSS,
      customer: "Southridge Media Services",
      dealId: "DEAL-33045",
      status: CaseStatus.InProgress,
      priority: Priority.High,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: buQueue.id,
      justification:
        "ESS/MSS combined hardware + software: UCS blades plus hypervisor stack extension; BU pricing in flight.",
      essSupportSubtype: EssMssSupportSubtype.HARDWARE_AND_SOFTWARE,
      migrationPlan:
        "Migration plan: retire first blade pair post-storage migration; keep second pair for DR warm standby; software uplift aligned to hardware RMA window; customer DR drill scheduled before final billing.",
      migrationTimeline: "Hardware RMA batch 1: 2026-09-01; software uplift: 2026-09-08 → 2026-09-15.",
      targetReplacementProduct: "UCS X-Series + Intersight-managed firmware track.",
      hardwarePhysicalLocation:
        "Southridge Primary DC — 88 Broadcast Way, Atlanta GA 30318, USA (pod SR-MEDIA-01, chassis 3–4).",
      softwareDeploymentType: "On-prem VMware + UCS Manager (production).",
      softwareProductFamily: "UCS / hypervisor management plane (application-tier automation).",
      softwareOnPremise: true,
      softwarePerpetualLicense: true,
      softwareIsApplicationSoftware: true,
      softwareNotIosIosXr: true,
      environmentIsProduction: true,
      essEligibilityAcknowledged: false,
      partnerName: "Southridge OEM Partner",
      quoteBookingStatus: QuoteBookingStatus.NOT_BOOKED,
      notBookedReason:
        "Budget frozen for the fiscal half — procurement will not issue PO until next planning cycle.",
      assets: [
        {
          platformName: "UCS B200 M5",
          softwareVersion: "4.2(3d)",
          serialNumbers: "SR-UCS-B200-03\nSR-UCS-B200-04",
          hwLdosDate: new Date("2026-11-15"),
          quantity: 12,
          buCost: 33_200,
          cxCost: 14_276,
        },
        {
          platformName: "UCS B200 M5",
          softwareVersion: "4.2(3d)",
          serialNumbers: "SR-UCS-B200-05\nSR-UCS-B200-06",
          hwLdosDate: new Date("2026-11-15"),
          quantity: 12,
          buCost: 33_200,
          cxCost: 14_276,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_HARDWARE,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
    },
    {
      caseId: "EoVSS-2026-100013",
      requestType: RequestType.EoVSS,
      customer: "City Power and Light Utility",
      dealId: "DEAL-44188",
      status: CaseStatus.Blocked,
      priority: Priority.High,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Blocked on external VAP dependency.",
      assets: [
        {
          platformName: "ASR 9903",
          softwareVersion: "24.4.2",
          serialNumbers: "SN-CPL-9903",
          hwLdosDate: new Date("2027-09-01"),
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.Blocked,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: cx.id,
          blockerReason: "VAP team waiting on partner attestation.",
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
      refs: [{ type: ExternalReferenceType.VAP_ID, referenceId: "VAP-NAM-22001", externalStatus: "Blocked", taskIndex: 4 }],
    },
    {
      caseId: "EoSM-2026-100014",
      requestType: RequestType.EoSM,
      customer: "Woodgrove National Bank",
      dealId: "DEAL-55100",
      status: CaseStatus.InProgress,
      priority: Priority.Medium,
      requesterId: sales.id,
      ownerId: cx.id,
      assignedTeamId: financeTeam.id,
      justification: "Finance-gated EoSM extension for renewal.",
      migrationPlan:
        "EoSM: final software maintenance release planned before renewal gate; dual-control approvals for finance sign-off.",
      partnerName: "Example channel partner (optional field)",
      assets: [{ platformName: "Catalyst 9400", softwareVersion: "17.14.1", quantity: 4 }],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: finance.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: finance.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotStarted,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
        },
      ],
    },
  ];

  for (const c of cases) {
    const primary = c.assets[0];
    const created = await prisma.case.create({
      data: {
        caseId: c.caseId,
        requestType: c.requestType,
        customerName: c.customer,
        dealId: c.dealId ?? null,
        platform: primary?.platformName ?? null,
        softwareVersion: primary?.softwareVersion ?? null,
        status: c.status,
        priority: c.priority,
        requesterId: c.requesterId,
        ownerId: c.ownerId,
        assignedTeamId: c.assignedTeamId,
        extensionStartDate: new Date("2026-05-01"),
        extensionEndDate: new Date("2027-04-30"),
        businessJustification: c.justification,
        migrationPlan: c.migrationPlan ?? null,
        essSupportSubtype: c.essSupportSubtype ?? null,
        migrationTimeline: c.migrationTimeline ?? null,
        targetReplacementProduct: c.targetReplacementProduct ?? null,
        hardwarePhysicalLocation: c.hardwarePhysicalLocation ?? null,
        softwareDeploymentType: c.softwareDeploymentType ?? null,
        softwareProductFamily: c.softwareProductFamily ?? null,
        softwareOnPremise: c.softwareOnPremise ?? null,
        softwarePerpetualLicense: c.softwarePerpetualLicense ?? null,
        softwareIsApplicationSoftware: c.softwareIsApplicationSoftware ?? null,
        softwareNotIosIosXr: c.softwareNotIosIosXr ?? null,
        environmentIsProduction: c.environmentIsProduction ?? null,
        essEligibilityAcknowledged: c.essEligibilityAcknowledged ?? false,
        partnerName: c.partnerName ?? null,
        quoteBookingStatus: c.quoteBookingStatus ?? QuoteBookingStatus.OPEN,
        notBookedReason: c.notBookedReason ?? null,
        routingNote: c.routingNote ?? null,
        assets: {
          create: c.assets.map((a, i) => ({
            sortOrder: i,
            platformName: a.platformName,
            softwareVersion: a.softwareVersion ?? null,
            serialNumbers: a.serialNumbers ?? null,
            eolBulletinLink: a.eolBulletinLink ?? null,
            hwLdosDate: a.hwLdosDate ?? null,
            quantity: a.quantity ?? null,
            buCost: a.buCost ?? 0,
            cxCost: a.cxCost ?? 0,
          })),
        },
      },
      include: { assets: { orderBy: { sortOrder: "asc" } } },
    });

    const assetIds = created.assets.map((a) => a.id);

    const createdTasks =
      c.tasks.length === 0
        ? []
        : await prisma.$transaction(
            c.tasks.map((t) =>
              prisma.task.create({
                data: {
                  caseId: created.id,
                  caseAssetId: t.assetIndex !== undefined ? assetIds[t.assetIndex]! : null,
                  type: t.type,
                  status: t.status,
                  ownerId: t.ownerId,
                  assignedTeamId: t.assignedTeamId,
                  isRequired: t.isRequired ?? true,
                  isRunnable: t.isRunnable ?? false,
                  activatedAt: t.activatedAt ?? null,
                  notes: t.notes,
                  blockerReason: t.blockerReason,
                  notRequiredReason: t.notRequiredReason,
                  dueDate: new Date("2026-05-20"),
                },
              })
            )
          );

    if (c.refs?.length) {
      for (const r of c.refs) {
        const taskId =
          r.taskIndex !== undefined ? createdTasks[r.taskIndex]?.id ?? null : null;
        await prisma.externalReference.create({
          data: {
            caseId: created.id,
            taskId,
            referenceType: r.type,
            referenceId: r.referenceId,
            externalStatus: r.externalStatus,
          },
        });
      }
    }

    await prisma.activityLog.createMany({
      data: [
        {
          caseId: created.id,
          userId: c.requesterId,
          action: "case_created",
          details: `Case ${c.caseId} created (${c.requestType}).`,
        },
        {
          caseId: created.id,
          userId: cx.id,
          action: "status_observed",
          details: `Current status: ${c.status}.`,
        },
      ],
    });
  }

  const case1 = await prisma.case.findFirst({ where: { caseId: "EoVSS-2026-100001" } });
  if (case1) {
    await prisma.comment.create({
      data: {
        caseId: case1.id,
        userId: cx.id,
        body: "CX picked up triage — BU review in parallel with VAP tracking.",
      },
    });
    await prisma.attachment.create({
      data: {
        caseId: case1.id,
        fileName: "customer-justification-summary.pdf",
        filePath: `/demo/storage/${case1.id}/customer-justification-summary.pdf`,
        uploadedById: sales.id,
      },
    });
  }

  console.log("Seed complete. Demo password for all users:", DEMO_PASSWORD);
  console.log(
    "Users:",
    [sales.email, cx.email, bu.email, finance.email, leader.email, admin.email].join(", ")
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
