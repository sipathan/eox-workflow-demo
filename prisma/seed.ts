/**
 * Deterministic demo seed: **10 users** (4 CX, 6 general; **8 with workload**, **2 with zero assignments**), **15 cases**.
 * Password: Demo123! — see README. “Inactive” personas (`cx.inactive@local`, `account.inactive@local`) have **no** cases
 * and **no** task rows but stay **`isActive: true`** so sign-in and empty states work with current session code.
 *
 * **Salesforce IB (mock provider)** — seeded refs + activity logs:
 * | Case | Role |
 * |------|------|
 * | `EoVSS-2026-200001` | IB **Created** + attempt/success **ActivityLog** trail |
 * | `EoSM-2026-200006` | IB **Ready** (no SF Id); EoSM ladder intact |
 * | `EoVSS-2026-200015` | IB **Failed** + attempt/failure **ActivityLog**; **Retry** succeeds (`priorFailedAttempt`) |
 * | `EoSM-2026-200008` | No IB row — CX (**Jordan**, **Priya**, **Luis**) demos **Create IB case** live |
 *
 * EoVSS / EoSM / ESS case mix unchanged apart from these IB rows.
 */
import {
  Prisma,
  PrismaClient,
  RoleKey,
  TeamType,
  CaseStatus,
  RequestType,
  Priority,
  TaskType,
  TaskStatus,
  ExternalReferenceType,
  ExternalReferenceIntegrationState,
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
      name: "BU Review Queue — AMER",
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

  /** CX (1/4) + Account + Platform admin — full demo spine. */
  const jordan = await prisma.user.create({
    data: {
      email: "cx.primary@local",
      name: "Jordan Okonkwo (CX · Account · Platform admin)",
      passwordHash,
      roles: {
        create: [
          { roleId: roleByKey.CX_OPS.id },
          { roleId: roleByKey.ACCOUNT_TEAM.id },
          { roleId: roleByKey.PLATFORM_ADMIN.id },
        ],
      },
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

  const priya = await prisma.user.create({
    data: {
      email: "cx.priya@local",
      name: "Priya Natarajan (CX Operations)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.CX_OPS.id }] },
      teams: { create: [{ teamId: cxOpsTeam.id }] },
    },
  });

  const luis = await prisma.user.create({
    data: {
      email: "cx.luis@local",
      name: "Luis Fernández (CX Operations)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.CX_OPS.id }] },
      teams: { create: [{ teamId: cxOpsTeam.id }] },
    },
  });

  /**
   * CX roster slot with **no** seeded cases or task assignments (empty portfolio after login).
   * `isActive` stays true so demo auth/session works; “inactive” = zero workload in this dataset.
   */
  await prisma.user.create({
    data: {
      email: "cx.inactive@local",
      name: "Dana Frost (CX — zero assignments in seed)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.CX_OPS.id }] },
    },
  });

  const alex = await prisma.user.create({
    data: {
      email: "sales.demo@local",
      name: "Alex Rivera (Account Team)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.ACCOUNT_TEAM.id }] },
    },
  });

  const maya = await prisma.user.create({
    data: {
      email: "account.maya@local",
      name: "Maya Chen (Account Team)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.ACCOUNT_TEAM.id }] },
    },
  });

  const sam = await prisma.user.create({
    data: {
      email: "bu.demo@local",
      name: "Sam Patel (BU Contributor)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.BU_CONTRIBUTOR.id }] },
      teams: { create: [{ teamId: buQueue.id }] },
    },
  });

  const taylor = await prisma.user.create({
    data: {
      email: "finance.demo@local",
      name: "Taylor Kim (Finance Approver)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.FINANCE_APPROVER.id }] },
      teams: { create: [{ teamId: financeTeam.id }] },
    },
  });

  const morgan = await prisma.user.create({
    data: {
      email: "leader.demo@local",
      name: "Morgan Lee (Leadership)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.LEADERSHIP_READONLY.id }] },
      teams: { create: [{ teamId: leadershipTeam.id }] },
    },
  });

  /** Account roster slot with **no** seeded cases or tasks (empty portfolio; same session note as Dana). */
  await prisma.user.create({
    data: {
      email: "account.inactive@local",
      name: "James Cole (Account — zero assignments in seed)",
      passwordHash,
      roles: { create: [{ roleId: roleByKey.ACCOUNT_TEAM.id }] },
    },
  });

  type AssetSeed = {
    platformName: string;
    softwareVersion?: string | null;
    serialNumbers?: string | null;
    eolBulletinLink?: string | null;
    hwLdosDate?: Date | null;
    quantity?: number | null;
    buCost?: number;
    cxCost?: number;
  };

  type TaskSeed = {
    type: TaskType;
    status: TaskStatus;
    assetIndex?: number;
    ownerId?: string;
    assigneeUserIds?: string[];
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
    routingNote?: string | null;
    /** Case-level notes (e.g. commercial context, follow-up reminders). */
    notes?: string | null;
    assets: AssetSeed[];
    tasks: TaskSeed[];
    refs?: Array<{
      type: ExternalReferenceType;
      referenceId: string | null;
      externalStatus?: string;
      taskIndex?: number;
      externalSystemName?: string | null;
      integrationState?: ExternalReferenceIntegrationState | null;
      externalKey?: string | null;
      externalRecordUrl?: string | null;
      lastAttemptAt?: Date | null;
      lastErrorMessage?: string | null;
      integrationMetadata?: Prisma.InputJsonValue | null;
      notes?: string | null;
    }>;
  };

  const T0 = new Date("2026-01-08T12:00:00.000Z");
  const T1 = new Date("2026-01-09T09:00:00.000Z");
  const T2 = new Date("2026-01-10T15:00:00.000Z");

  function directAssigneeIdsForSeed(t: TaskSeed): string[] {
    const s = new Set<string>();
    for (const id of t.assigneeUserIds ?? []) {
      if (id) s.add(id);
    }
    if (t.ownerId) s.add(t.ownerId);
    return [...s];
  }

  const cases: CaseSeed[] = [
    {
      caseId: "EoVSS-2026-200001",
      requestType: RequestType.EoVSS,
      customer: "Meridian Health Systems",
      dealId: "DEAL-CX-440021",
      routingNote:
        "Account intake → CX Ops Global: standard EoVSS queue; weekly checkpoint with customer until quote; BU parallel on both platforms.",
      notes:
        "Commercial snapshot: BU/CX economics validated on both lines (ASR 9902 + Catalyst 9500); CX cost ≈43% of BU per policy. Renewal gate FY26 Q2.",
      status: CaseStatus.InProgress,
      priority: Priority.High,
      requesterId: alex.id,
      ownerId: jordan.id,
      assignedTeamId: cxOpsTeam.id,
      justification:
        "Enterprise WAN refresh — need EoVSS alignment on ASR 9000 and Catalyst 9500 HW before renewal gate.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "ASR 9902",
          softwareVersion: "24.4.2",
          serialNumbers: "FJC24401L0X\nFJC24401L0Y",
          eolBulletinLink: "https://www.cisco.com/c/en/us/products/collateral/routers/asr-9000-series-aggregation-services-routers/eos-eol-notice-c51-743016.html",
          hwLdosDate: new Date("2028-03-31"),
          quantity: 2,
          buCost: 118_000,
          cxCost: 50_740,
        },
        {
          platformName: "Catalyst 9500",
          softwareVersion: "17.12.4",
          serialNumbers: "FCW2443A12B",
          eolBulletinLink: "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9500-series-switches/eos-eol-notice-c51-740012.html",
          hwLdosDate: new Date("2027-11-30"),
          quantity: 1,
          buCost: 62_500,
          cxCost: 26_875,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
          assigneeUserIds: [sam.id, jordan.id],
        },
        {
          type: TaskType.BUReview,
          assetIndex: 1,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
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
          assignedTeamId: financeTeam.id,
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
        { type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-ENT-2026-889120", externalStatus: "Draft" },
        { type: ExternalReferenceType.VAP_ID, referenceId: "VAP-AMER-44102", externalStatus: "Queued" },
        {
          type: ExternalReferenceType.SALESFORCE_IB,
          referenceId: "5006900000MERD1EAA",
          externalKey: "16310418",
          externalSystemName: "Salesforce",
          integrationState: ExternalReferenceIntegrationState.CREATED,
          externalRecordUrl:
            "https://example.my.salesforce.com/lightning/r/Case/5006900000MERD1EAA/view",
          externalStatus: "Working — CX triage",
          lastAttemptAt: new Date("2026-01-10T16:00:00.000Z"),
          integrationMetadata: {
            demo: true,
            provider: "mock",
            customer: "Meridian Health Systems",
            correlation: "EoVSS-2026-200001",
          },
        },
      ],
    },
    {
      caseId: "EoVSS-2026-200002",
      requestType: RequestType.EoVSS,
      customer: "Northwind Utilities Cooperative",
      dealId: "DEAL-CX-440022",
      routingNote: "Account Team submit → CX Ops Global owner; dual CX validation on SCADA serial attestation.",
      status: CaseStatus.Submitted,
      priority: Priority.Medium,
      requesterId: maya.id,
      ownerId: priya.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Transmission SCADA refresh — serial validation in flight for IR1101 gateways.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Cisco IR1101",
          softwareVersion: "17.9.5a",
          serialNumbers: "IR11-NWU-001",
          eolBulletinLink:
            "https://www.cisco.com/c/en/us/products/collateral/routers/1100-series-integrated-services-router-routers/eos-eol-notice.html",
          hwLdosDate: new Date("2026-09-15"),
          quantity: 1,
          buCost: 18_200,
          cxCost: 7_826,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
          assigneeUserIds: [priya.id, jordan.id],
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
          assignedTeamId: financeTeam.id,
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
      caseId: "EoVSS-2026-200003",
      requestType: RequestType.EoVSS,
      customer: "Contoso Manufacturing Ltd",
      dealId: "DEAL-CX-440023",
      status: CaseStatus.Closed,
      priority: Priority.Medium,
      requesterId: alex.id,
      ownerId: jordan.id,
      assignedTeamId: cxOpsTeam.id,
      routingNote: "Sales/Account requester → CX-owned through booking; leadership visibility via standard reporting.",
      justification: "Campus core EoVSS cycle completed — booking captured.",
      quoteBookingStatus: QuoteBookingStatus.BOOKED,
      notes:
        "Closed / booked: full line economics — quantity 4, BU list + CX share (43%) aligned to finance rollup; no open exceptions.",
      assets: [
        {
          platformName: "Catalyst 9400",
          softwareVersion: "17.11.2",
          serialNumbers: "FDO25021A9C\nFDO25021A9D\nFDO25021A9E\nFDO25021A9F",
          eolBulletinLink:
            "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9400-series-switches/eos-eol-notice-c51-740011.html",
          hwLdosDate: new Date("2027-06-30"),
          quantity: 4,
          buCost: 210_000,
          cxCost: 90_300,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: taylor.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotRequired,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
          notRequiredReason: "Not needed for this closure path.",
        },
      ],
      refs: [{ type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-ENT-2026-770011", externalStatus: "Booked" }],
    },
    {
      caseId: "EoVSS-2026-200004",
      requestType: RequestType.EoVSS,
      customer: "Fabrikam Telecommunications",
      dealId: "DEAL-CX-440024",
      routingNote: "Account-submitted EoVSS; CX owner on CX Ops Global — partner attestation blocking VAP milestone.",
      status: CaseStatus.Blocked,
      priority: Priority.High,
      requesterId: alex.id,
      ownerId: luis.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Metro aggregation — partner attestation delay on VAP.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "ASR 9006",
          softwareVersion: "7.6.2",
          serialNumbers: "FXK25041R1",
          buCost: 95_000,
          cxCost: 40_850,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: taylor.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.Blocked,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
          blockerReason: "Partner attestation pending on VAP portal — CX chasing weekly.",
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
        { type: ExternalReferenceType.VAP_ID, referenceId: "VAP-EMEA-22088", externalStatus: "Blocked", taskIndex: 4 },
      ],
    },
    {
      caseId: "EoVSS-2026-200005",
      requestType: RequestType.EoVSS,
      customer: "Litware Retail Group",
      dealId: "DEAL-CX-440025",
      routingNote: "Deal desk engaged — align quote ID with CCW draft.",
      status: CaseStatus.InReview,
      priority: Priority.Low,
      requesterId: alex.id,
      ownerId: priya.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Distribution centers — standardized EoVSS review for ISR and switching.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "ISR 4461",
          softwareVersion: "17.9.5a",
          serialNumbers: "LWR-ISR-9001",
          buCost: 28_400,
          cxCost: 12_212,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
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
          assignedTeamId: financeTeam.id,
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
      refs: [{ type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-RTL-2026-551200", externalStatus: "In review" }],
    },
    {
      caseId: "EoSM-2026-200006",
      requestType: RequestType.EoSM,
      customer: "Woodgrove National Bank",
      dealId: "DEAL-CX-550100",
      routingNote: "Account requester → CX Ops Global owns case; BU + Finance tasks per EoSM ladder (quote row with Finance + CX assignees).",
      status: CaseStatus.InProgress,
      priority: Priority.Medium,
      requesterId: maya.id,
      ownerId: jordan.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "EoSM extension window — finance sign-off on maintenance renewal posture.",
      migrationPlan:
        "EoSM: final software maintenance train before renewal gate; security posture tracked under EoVS/EoVSS policy separately.",
      partnerName: "Cisco Partner: Alpine Networks",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Catalyst 9400",
          softwareVersion: "17.14.1",
          serialNumbers: "WNB-C9400-01",
          quantity: 2,
          buCost: 88_000,
          cxCost: 37_840,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: taylor.id,
          assigneeUserIds: [taylor.id, jordan.id],
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
        { type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-FIN-2026-330901", externalStatus: "In progress" },
        {
          type: ExternalReferenceType.SALESFORCE_IB,
          referenceId: null,
          externalSystemName: "Salesforce",
          integrationState: ExternalReferenceIntegrationState.READY,
          notes:
            "IB shell reserved in orchestration — CX to trigger provider submit after Finance checkpoint on quote row.",
          lastAttemptAt: new Date("2026-01-11T14:30:00.000Z"),
          integrationMetadata: {
            demo: true,
            provider: "mock",
            stage: "pre_submit",
            seededScenario: "ib_ready_woodgrove_eosm",
          },
        },
      ],
    },
    {
      caseId: "EoSM-2026-200007",
      requestType: RequestType.EoSM,
      customer: "Adventure Works CPG",
      dealId: "DEAL-CX-550101",
      status: CaseStatus.AwaitingInfo,
      priority: Priority.Medium,
      requesterId: alex.id,
      ownerId: priya.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "EoSM coverage discussion — waiting on customer network inventory.",
      migrationPlan: "EoSM context documented; supporting details to follow after info return.",
      notes:
        "Follow-up workflow: Additional Info task holds gate — need customer export of Nexus serials + Smart Licensing tokens before quote.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Nexus 9300",
          softwareVersion: "10.3(5)",
          serialNumbers: "N9K-AW-221",
          buCost: 54_000,
          cxCost: 23_220,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: financeTeam.id,
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
          status: TaskStatus.InProgress,
          isRequired: true,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
        },
      ],
    },
    /** **Salesforce IB:** no seeded IB row — intake complete; CX demos **Create IB case** end-to-end against mock provider. */
    {
      caseId: "EoSM-2026-200008",
      requestType: RequestType.EoSM,
      customer: "Wide World Importers",
      routingNote: "Account-submitted EoSM; CX cleared VAP — Ready for Release pending packaging handoff.",
      status: CaseStatus.ReadyForRelease,
      priority: Priority.Low,
      requesterId: maya.id,
      ownerId: luis.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "EoSM milestone cleared — release packaging with CX.",
      migrationPlan: "EoSM software maintenance window closed; handoff to operations.",
      quoteBookingStatus: QuoteBookingStatus.BOOKED,
      assets: [
        {
          platformName: "ISR 4331",
          softwareVersion: "16.12.8",
          serialNumbers: "WWI-ISR-1188",
          buCost: 12_600,
          cxCost: 5_418,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
        },
        {
          type: TaskType.BUReview,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.BUPricing,
          assetIndex: 0,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: buQueue.id,
          ownerId: sam.id,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: taylor.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
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
      caseId: "EoSM-2026-200009",
      requestType: RequestType.EoSM,
      customer: "Blue Yonder Airlines",
      status: CaseStatus.Submitted,
      priority: Priority.Critical,
      requesterId: alex.id,
      ownerId: jordan.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "Fleet connectivity — EoSM review for 17.9 train on branch routers.",
      migrationPlan: "EoSM: maintenance cadence alignment with OEM bulletin schedule.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Catalyst 9200",
          softwareVersion: "17.12.3",
          serialNumbers: "BYA-C9200-44",
          buCost: 22_000,
          cxCost: 9_460,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
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
          assignedTeamId: financeTeam.id,
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
      caseId: "EoSM-2026-200010",
      requestType: RequestType.EoSM,
      customer: "Tailspin Toys (draft)",
      status: CaseStatus.Draft,
      priority: Priority.Medium,
      requesterId: maya.id,
      justification: "Draft EoSM intake — Maya has not submitted; CX/BU/Finance see empty queues for this ID.",
      migrationPlan: "",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Meraki MS390",
          softwareVersion: "16.16.1",
          serialNumbers: "",
          buCost: 0,
          cxCost: 0,
        },
      ],
      tasks: [],
    },
    {
      caseId: "ESSMSS-2026-200011",
      requestType: RequestType.ESS_MSS,
      customer: "Coho Vineyard Holdings",
      dealId: "DEAL-CX-660200",
      status: CaseStatus.InProgress,
      priority: Priority.High,
      requesterId: alex.id,
      ownerId: jordan.id,
      assignedTeamId: cxOpsTeam.id,
      routingNote: "Account-submitted ESS/MSS; CX-owned dual eligibility rows (HW+SW) per service template — no BU ladder.",
      justification: "ESS hardware + software scope — eligibility and quote path.",
      migrationPlan:
        "Consolidate legacy switching and ISR estate under ESS coverage; phased hardware swap with software compliance review.",
      essSupportSubtype: EssMssSupportSubtype.HARDWARE_AND_SOFTWARE,
      migrationTimeline: "Phased: hardware Q2, software hardening Q3.",
      targetReplacementProduct: "Catalyst 9500 + ISR 4461 standard",
      hardwarePhysicalLocation: "Napa DC + Sonoma edge sites",
      softwareDeploymentType: "On-prem VMware + bare metal network OS",
      softwareProductFamily: "IOS XE switching and routing",
      softwareOnPremise: true,
      softwarePerpetualLicense: false,
      softwareIsApplicationSoftware: false,
      softwareNotIosIosXr: false,
      environmentIsProduction: true,
      essEligibilityAcknowledged: true,
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Catalyst 9300",
          softwareVersion: "17.9.4a",
          serialNumbers: "CVH-C9300-01",
          eolBulletinLink:
            "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/eos-eol-notice-c51-740012.html",
          hwLdosDate: new Date("2027-01-31"),
          quantity: 2,
          buCost: 48_000,
          cxCost: 20_640,
        },
        {
          platformName: "ISR 4451",
          softwareVersion: "17.6.3a",
          serialNumbers: "CVH-ISR-02",
          eolBulletinLink:
            "https://www.cisco.com/c/en/us/products/collateral/routers/4000-series-integrated-services-router-isr-routers/eos-eol-notice-c51-740010.html",
          hwLdosDate: new Date("2026-12-15"),
          quantity: 1,
          buCost: 31_000,
          cxCost: 13_330,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_HARDWARE,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: financeTeam.id,
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
      refs: [{ type: ExternalReferenceType.APAS_NPI, referenceId: "NPI-ESS-2026-1044", externalStatus: "Tracking" }],
    },
    {
      caseId: "ESSMSS-2026-200012",
      requestType: RequestType.ESS_MSS,
      customer: "Relecloud Power & Water",
      status: CaseStatus.InReview,
      priority: Priority.Medium,
      requesterId: maya.id,
      ownerId: priya.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "ESS hardware-only renewal — single-site focus.",
      migrationPlan: "Replace aging Catalyst 3850 stack; ESS hardware eligibility confirmed with customer PM.",
      essSupportSubtype: EssMssSupportSubtype.HARDWARE,
      hardwarePhysicalLocation: "Denver field office MDF",
      environmentIsProduction: true,
      essEligibilityAcknowledged: true,
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Catalyst 3850",
          softwareVersion: "16.12.10",
          serialNumbers: "RCW-C3850-STACK-01",
          hwLdosDate: new Date("2026-08-01"),
          buCost: 36_500,
          cxCost: 15_695,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_HARDWARE,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.InProgress,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: taylor.id,
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
      caseId: "ESSMSS-2026-200013",
      requestType: RequestType.ESS_MSS,
      customer: "Alpine Ski Logistics",
      status: CaseStatus.Closed,
      priority: Priority.Low,
      requesterId: alex.id,
      ownerId: jordan.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "ESS software scope — closed after booking.",
      migrationPlan: "Software-only ESS path; customer accepted support model.",
      essSupportSubtype: EssMssSupportSubtype.SOFTWARE,
      softwareDeploymentType: "Private cloud Kubernetes fronting IOS-XE services",
      softwareProductFamily: "Automation controllers",
      softwareOnPremise: true,
      softwarePerpetualLicense: false,
      softwareIsApplicationSoftware: true,
      softwareNotIosIosXr: true,
      environmentIsProduction: true,
      essEligibilityAcknowledged: true,
      quoteBookingStatus: QuoteBookingStatus.BOOKED,
      assets: [
        {
          platformName: "Virtual routing node",
          softwareVersion: "17.12.1",
          serialNumbers: "N/A — software inventory ID ASL-VRT-09",
          buCost: 8_400,
          cxCost: 3_612,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: financeTeam.id,
          ownerId: taylor.id,
        },
        {
          type: TaskType.VAPTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
        },
        {
          type: TaskType.FlagRemovalTracking,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: jordan.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.NotRequired,
          isRequired: false,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
          notRequiredReason: "Software-only path — no info return.",
        },
      ],
      refs: [{ type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-ESS-2026-221100", externalStatus: "Booked" }],
    },
    {
      caseId: "ESSMSS-2026-200014",
      requestType: RequestType.ESS_MSS,
      customer: "Southridge Medical Center",
      status: CaseStatus.Blocked,
      priority: Priority.Critical,
      requesterId: maya.id,
      ownerId: luis.id,
      assignedTeamId: cxOpsTeam.id,
      justification: "ESS software + hardware — eligibility blocked on environment declaration.",
      migrationPlan: "Teaching hospital needs ESS for hybrid clinical network; migration narrative under review.",
      essSupportSubtype: EssMssSupportSubtype.HARDWARE_AND_SOFTWARE,
      hardwarePhysicalLocation: "Phoenix campus — clinical VLAN segregation",
      softwareDeploymentType: "Hybrid cloud control plane",
      softwareProductFamily: "Secure access service edge",
      softwareOnPremise: false,
      softwarePerpetualLicense: false,
      softwareIsApplicationSoftware: true,
      softwareNotIosIosXr: false,
      environmentIsProduction: false,
      essEligibilityAcknowledged: false,
      quoteBookingStatus: QuoteBookingStatus.NOT_BOOKED,
      notBookedReason: "Eligibility review paused — customer to confirm production posture for regulated VLANs.",
      assets: [
        {
          platformName: "Catalyst 9800 WLC",
          softwareVersion: "17.9.4",
          serialNumbers: "SMC-WLC-301",
          buCost: 41_200,
          cxCost: 17_716,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: luis.id,
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.Blocked,
          isRunnable: true,
          activatedAt: T1,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
          assigneeUserIds: [priya.id, jordan.id],
          notes: ESS_MSS_ELIGIBILITY_NOTE_HARDWARE,
          blockerReason: "Non-production declaration conflicts with regulated VLAN scope — CX scheduling workshop.",
        },
        {
          type: TaskType.EligibilityReview,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: cxOpsTeam.id,
          notes: ESS_MSS_ELIGIBILITY_NOTE_SOFTWARE,
        },
        {
          type: TaskType.QuoteTracking,
          status: TaskStatus.NotStarted,
          isRunnable: false,
          activatedAt: null,
          assignedTeamId: financeTeam.id,
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
    /**
     * Early-stage **Awaiting Info**: missing CMDB serial export — BU ladder not yet runnable (contrast with EoSM-200007 mid-pipeline info return).
     * **Salesforce IB:** seeded `FAILED` row + activity log (attempt/failure); CX **Retry** succeeds via mock (`priorFailedAttempt`).
     */
    {
      caseId: "EoVSS-2026-200015",
      requestType: RequestType.EoVSS,
      customer: "VanArsdel Precision Components",
      dealId: "DEAL-CX-440026",
      routingNote: "Account Team (Maya) → CX Ops Global; BU queue parked until serial attestation file lands.",
      status: CaseStatus.AwaitingInfo,
      priority: Priority.Medium,
      requesterId: maya.id,
      ownerId: priya.id,
      assignedTeamId: cxOpsTeam.id,
      justification:
        "Campus access refresh — Catalyst 9300L stack quoted in CCW; customer delayed exporting serials from ServiceNow CMDB.",
      notes:
        "Follow-up: request official serial CSV + POE draw per switch by 2026-01-22; unblock BU Review once file attached to case.",
      quoteBookingStatus: QuoteBookingStatus.OPEN,
      assets: [
        {
          platformName: "Catalyst 9300L",
          softwareVersion: "17.12.4",
          serialNumbers: null,
          eolBulletinLink:
            "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/eos-eol-notice-c51-740012.html",
          hwLdosDate: new Date("2028-01-31"),
          quantity: 6,
          buCost: 0,
          cxCost: 0,
        },
      ],
      tasks: [
        {
          type: TaskType.IntakeValidation,
          status: TaskStatus.Completed,
          isRunnable: true,
          activatedAt: T0,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
        },
        {
          type: TaskType.AdditionalInfoRequest,
          status: TaskStatus.InProgress,
          isRequired: true,
          isRunnable: true,
          activatedAt: T2,
          assignedTeamId: cxOpsTeam.id,
          ownerId: priya.id,
          notes: "Awaiting customer CMDB export (serials + cabinet IDs) before BU can validate hardware scope.",
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
          assignedTeamId: financeTeam.id,
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
      refs: [
        { type: ExternalReferenceType.QUOTE_ID, referenceId: "QTE-MFG-2026-661900", externalStatus: "Awaiting data" },
        {
          type: ExternalReferenceType.SALESFORCE_IB,
          referenceId: null,
          externalKey: null,
          externalRecordUrl: null,
          externalSystemName: "Salesforce",
          integrationState: ExternalReferenceIntegrationState.FAILED,
          lastAttemptAt: new Date("2026-01-14T11:20:00.000Z"),
          lastErrorMessage:
            "MOCK_FORCED_FAILURE: Simulated Salesforce error (demo): first attempt fails for this case id; a retry after recording failure succeeds.",
          integrationMetadata: {
            demo: true,
            provider: "mock",
            scenario: "fail_first_attempt",
            seededScenario: "ib_failed_van_arsdel_retry",
          },
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
        notes: c.notes ?? null,
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
            c.tasks.map((t) => {
              const directIds = directAssigneeIdsForSeed(t);
              const ownerId = t.ownerId ?? directIds[0] ?? null;
              return prisma.task.create({
                data: {
                  caseId: created.id,
                  caseAssetId: t.assetIndex !== undefined ? assetIds[t.assetIndex]! : null,
                  type: t.type,
                  status: t.status,
                  ownerId,
                  assignedTeamId: t.assignedTeamId,
                  isRequired: t.isRequired ?? true,
                  isRunnable: t.isRunnable ?? false,
                  activatedAt: t.activatedAt ?? null,
                  notes: t.notes,
                  blockerReason: t.blockerReason,
                  notRequiredReason: t.notRequiredReason,
                  dueDate: new Date("2026-05-20"),
                  assignees:
                    directIds.length > 0
                      ? {
                          create: directIds.map((userId) => ({
                            userId,
                            assignedById: null,
                          })),
                        }
                      : undefined,
                },
              });
            })
          );

    if (c.refs?.length) {
      for (const r of c.refs) {
        const taskId = r.taskIndex !== undefined ? createdTasks[r.taskIndex]?.id ?? null : null;
        await prisma.externalReference.create({
          data: {
            caseId: created.id,
            taskId,
            referenceType: r.type,
            referenceId: r.referenceId,
            externalStatus: r.externalStatus,
            externalSystemName: r.externalSystemName ?? null,
            integrationState: r.integrationState ?? null,
            externalKey: r.externalKey ?? null,
            externalRecordUrl: r.externalRecordUrl ?? null,
            lastAttemptAt: r.lastAttemptAt ?? null,
            lastErrorMessage: r.lastErrorMessage ?? null,
            integrationMetadata: r.integrationMetadata ?? undefined,
            ...(r.notes !== undefined && r.notes !== null ? { notes: r.notes } : {}),
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
          userId: jordan.id,
          action: "status_observed",
          details: `Seeded status: ${c.status}.`,
        },
      ],
    });
  }

  const case1 = await prisma.case.findFirst({ where: { caseId: "EoVSS-2026-200001" } });
  if (case1) {
    await prisma.activityLog.createMany({
      data: [
        {
          caseId: case1.id,
          userId: jordan.id,
          action: "salesforce_ib_create_attempt",
          details: "initial | EoVSS-2026-200001",
        },
        {
          caseId: case1.id,
          userId: jordan.id,
          action: "salesforce_ib_created",
          details: "SF Case 16310418 | 5006900000MERD1EAA (Salesforce IB mock provider)",
        },
      ],
    });
    await prisma.comment.create({
      data: {
        caseId: case1.id,
        userId: jordan.id,
        body: "CX triage: BU pricing moving on ASR line first — finance quote to follow Catalyst row.",
      },
    });
    await prisma.attachment.create({
      data: {
        caseId: case1.id,
        fileName: "meridian-wan-refresh-summary.pdf",
        filePath: `demo://${case1.id}/meridian-wan-refresh-summary.pdf`,
        uploadedById: alex.id,
      },
    });
  }

  const vanArsdelCase = await prisma.case.findFirst({ where: { caseId: "EoVSS-2026-200015" } });
  if (vanArsdelCase) {
    await prisma.activityLog.createMany({
      data: [
        {
          caseId: vanArsdelCase.id,
          userId: priya.id,
          action: "salesforce_ib_create_attempt",
          details: "initial | EoVSS-2026-200015",
        },
        {
          caseId: vanArsdelCase.id,
          userId: priya.id,
          action: "salesforce_ib_create_failed",
          details:
            "MOCK_FORCED_FAILURE: Simulated Salesforce error (demo): first attempt fails for this case id; a retry after recording failure succeeds.",
        },
      ],
    });
  }

  const demoEmails = [
    "cx.primary@local",
    "cx.priya@local",
    "cx.luis@local",
    "cx.inactive@local",
    "sales.demo@local",
    "account.maya@local",
    "bu.demo@local",
    "finance.demo@local",
    "leader.demo@local",
    "account.inactive@local",
  ];
  console.log(
    "Seed complete. 10 users (8 with seeded workload, 2 empty-portfolio), 15 cases. Salesforce IB demos: 200001 Created, 200006 Ready, 200015 Failed+retry, 200008 live Create. Password:",
    DEMO_PASSWORD
  );
  console.log("Users:", demoEmails.join(", "));
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
