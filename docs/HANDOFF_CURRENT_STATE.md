# Handoff — current state

Last updated: 2026-05-08 (**PostgreSQL** + Docker Compose pilot; Prisma migrations **`20260530120000_init_postgresql`**, **`20260531120000_task_assignees`**, **`20260601120000_salesforce_ib_external_reference`**. Quantity is **per `CaseAsset`**; **Case summary** shows **Total units (qty)** = sum of set per-line quantities, **—** when none. **Platforms & equipment** table column **Quantity**. Intake partner block is partner-only. **Multi-assignee tasks** via **`TaskAssignee`**. **Salesforce Issue Backlog (IB)** Phase 1: structured **`ExternalReferenceType.SALESFORCE_IB`** + Case Detail card + **`createSalesforceIbCaseAction`** through **`getSalesforceIbProvider()`** (mock default). **Seed:** **10** deterministic users (**4** CX, **6** general; **2** zero-workload personas with no cases/tasks but **`isActive`** for empty-state demos), **15** cases (**6** EoVSS incl. **`EoVSS-2026-200015`**, **5** EoSM, **4** ESS/MSS) with **four** IB demo shapes — see **`README.md`** / **`prisma/seed.ts`** header.)

## What this repo is

Local Next.js + Prisma + **PostgreSQL** demo for **EoVSS** / **EoSM** / **ESS/MSS** workflow (see `docs/PROJECT_CONTEXT.md`). Third bucket in code is **`RequestType.ESS_MSS`** (UI label **ESS/MSS**); public case IDs use prefix **`ESSMSS`**. **EoSM** = **End of Software Maintenance** (not Service Migration). **EoSM** marks the end of regular software maintenance / routine bug fixes; **security fixes** may continue per **EoVS / EoVSS** policy depending on product.

**EC2 / Docker pilot:** `Dockerfile` + `docker-compose.yml` run **Next.js (production)** and **Postgres 16**; app entrypoint runs **`prisma migrate deploy`** then **`next start`**. The **runtime** image copies **`src/`** and **`tsconfig.json`** from the build stage so **`docker compose exec app npx prisma db seed`** works (`prisma/seed.ts` imports **`../src/lib/workflow/task-templates`**). Postgres uses a named volume and is published as **`5432:5432`** so **host** tools (e.g. `npx prisma`, `npm run dev` with `DATABASE_URL=...@localhost:5432/...`) work alongside the **app** container, which still connects via **`postgres:5432`** on the Compose network. For a locked-down server-only deploy, remove or override the `ports:` mapping. **`SALESFORCE_IB_PROVIDER`** defaults to **`mock`** everywhere unless set — demos and pilots need **no** Salesforce connectivity. See **`README.md`** for env vars and exact commands.

## Data model (high level)

- **Case**: `dealId` is optional (`null` allowed). **`partnerName`** is optional for **all** request types (**EoVSS**, **EoSM**, **`ESS_MSS`**): never required on **submit** or on **other case mutations** (routing, booking, financials, tasks, etc.). Missing partner name **must not** block request creation or case updates. **`quoteBookingStatus`** (`OPEN`, `BOOKED`, `NOT_BOOKED`, `PASSED_OVER`) and optional **`notBookedReason`** (required in validation when status is `NOT_BOOKED` or `PASSED_OVER`; cleared when returning to `OPEN` / `BOOKED`). Legacy `platform` / `softwareVersion` / `serialNumbers` / `eolBulletinLink` / `hwLdosDate` remain on `Case` for backward compatibility but new intake writes **null** there; live data uses **CaseAsset** rows.
- **ESS/MSS (`ESS_MSS`)**: `essSupportSubtype` (`EssMssSupportSubtype`: hardware / software / both). Extra scalars: `migrationPlan` (required text on submit for this type), `migrationTimeline`, `targetReplacementProduct`, `hardwarePhysicalLocation`, `softwareDeploymentType`, `softwareProductFamily`, booleans for software eligibility signals (`softwareOnPremise`, `softwarePerpetualLicense`, `softwareIsApplicationSoftware`, `softwareNotIosIosXr`), `environmentIsProduction`, `essEligibilityAcknowledged`. MSS-specific workflow is **not** implemented yet; flags support review UX without hard-blocking product rules.
- **CaseAsset**: One row per platform/SKU line (`platformName`, `serialNumbers`, `eolBulletinLink`, `hwLdosDate`, `softwareVersion`, optional **`quantity`** (non-negative int when set), `sortOrder`, **`buCost`**, **`cxCost`** as demo USD floats). **Line total** = BU + CX via `platformTotalCost` in `src/lib/cases/financials.ts` (not stored). Case-level **rollups** use `rollupCaseFinancials` (same file). Schema history lived in SQLite-era migrations; **current** Postgres migrations are **`20260530120000_init_postgresql`** and **`20260531120000_task_assignees`**.
- **Task**: `caseAssetId` (optional), optional **`ownerId`** (legacy primary; kept in sync as **first** direct assignee when CX/Admin saves), `assignedTeamId`, `isRunnable`, `activatedAt`, optional **`notes`** (ESS/MSS eligibility rows ship template text here). **`TaskAssignee`**: many-to-many direct users on the **same** task row (`assignedAt`, optional **`assignedById`**). Default submitted rows: **`buildSubmittedCaseTaskRows`** in **`src/lib/workflow/task-templates.ts`** (request-type + **`essSupportSubtype`** aware; typically **no** individual assignees until CX sets them). Activation after edits: **`applyTaskActivationRules`** in **`src/lib/workflow/task-activation.ts`** (called from **`src/app/actions/case-workspace.ts`** after task updates).
- **`ExternalReference`**: Legacy **`QUOTE` / `VAP` / `APAS`** rows remain manual reference tracking. **`SALESFORCE_IB`** rows carry **`integrationState`** (`ExternalReferenceIntegrationState`), optional **`referenceId`** (SF Id), **`externalKey`** (case number), **`externalRecordUrl`**, **`lastAttemptAt`**, **`lastErrorMessage`**, optional **`integrationMetadata`**. Salesforce IB is **not** edited through the generic external-reference pickers on Case Detail; it uses **`SalesforceIbCaseSection`** + server actions only.

## Public case ID

Format: **`{TYPE_TOKEN}-{YYYY}-{SUFFIX}`** where **`TYPE_TOKEN`** is derived from `RequestType` via **`publicCaseIdTypeToken`** in `src/lib/cases/case-id-prefix.ts`: **`EoVSS`**, **`EoSM`**, and **`ESSMSS`** (for enum **`ESS_MSS`** — no slash in IDs). Suffix is random hex (demo-safe uniqueness). Implemented in `generateUniqueCaseId` in `src/app/actions/cases.ts`. Legacy SQLite migrations once rewrote **`EoSS-…`** → **`ESSMSS-…`**; fresh Postgres installs from the current baseline only ever store **`ESS_MSS`** / **`ESSMSS-…`**.

## Intake UI (New request)

- **Route**: `src/app/(dashboard)/cases/new/page.tsx` — **`PageHeader`** copy notes **EoSM (End of Software Maintenance)**, optional partner, optional **per-platform** quantity, optional Deal ID (CX / partner admin), multi-platform cards, submit outcomes, and that submit assigns a **service-prefixed** public case ID (**`EoVSS-`**, **`EoSM-`**, **`ESSMSS-`**).
- **Form**: `src/app/(dashboard)/cases/new/NewCaseForm.tsx` — **`useFieldArray`** on `assets`; each platform card includes optional **Quantity** (scoped to that line) plus **`IntakeAssetFinancialFields`** (`src/components/case/IntakeAssetFinancialFields.tsx`) for grouped **BU / CX** inputs with a **live line total** (`useWatch` + `platformTotalCost`) and an **“Apply 43% of BU as CX”** control (suggestion only). Step 0 heading **Service** (wire field remains **`requestType`**); card blurbs use **`REQUEST_TYPE_INTAKE_HINT`** in **`src/lib/ui/format.ts`** (**EoSM** = **End of Software Maintenance**; **ESS/MSS** blurb notes ESS-oriented intake and future MSS). For **`ESS_MSS`**, step **Details & platforms** shows a single **ESS/MSS** outer card with nested white cards: **Support subtype** (three radio tiles: Hardware, Software, Hardware + Software via **`formatEssMssSupportSubtype`**), **Migration plan** (details + optional timeline + optional replacement), conditional **Hardware location** (only if subtype includes hardware; copy points to platform cards for serials), conditional **Software & eligibility** (deployment, product family, environment, declaration fieldset, acknowledgement strip). **EoVSS** / **EoSM** keep **Supporting details (optional)** on `migrationPlan` only. **Partner (optional)** is partner name only (quantity lives on each platform card). **Review** step: migration plan uses `whitespace-pre-wrap` and full text up to ~220 chars before ellipsis; **Platforms** summary echoes per-row quantity when set. **Serial numbers & lifecycle** hints vary by request type. **EoVSS** still requires serials per row on submit; hardware-scoped **`ESS_MSS`** requires serials per validation.
- **Draft save**: `saveCaseDraftAction` persists only asset rows with a **non-empty platform name**; **`replaceCaseAssets` is always called** so removing all named platforms clears stored assets.
- **Validation**: `src/lib/validations/case.ts` — `caseAssetRowSchema` includes optional **`quantity`** per row (non-negative int); allows empty platform in the wire shape; **`submitCaseSchema`** `superRefine` requires a trimmed platform name on every row, **EoVSS** serial rules, and **`ESS_MSS`** rules (subtype, migration plan length, hardware/software conditional fields, eligibility ack when needed). **`partnerName`** and **`migrationPlan`** remain optional for **EoVSS** / **EoSM** on submit.
- **Submit**: `src/app/actions/cases.ts` — `generateUniqueCaseId`, `replaceCaseAssets`, `bootstrapSubmittedCaseTasks` (Intake Validation **runnable + `activatedAt` immediately**; task rows from **`buildSubmittedCaseTaskRows`** with **`requestType`** / **`essSupportSubtype`**).

## Case list (`/cases`)

- **Case visibility (`canViewCase`)** — **`src/lib/rbac.ts`**: **CX Ops** sees all cases; **Platform Admin** and **Leadership** see all; **everyone else** only cases they **requested** or where they have a **task** stake — direct assignee (`TaskAssignee` + `ownerId`) or **task queue** membership — across **all** task statuses. **`buildCaseAccessRow`** in **`src/lib/permissions/case-access-projection.ts`** is the single projection builder for list, detail, reports, and server actions.
- `src/app/(dashboard)/cases/page.tsx` — **`listCasesVisibleToUser`** then **portfolio-wide** (**CX / leadership / platform** via **`isPortfolioWideCaseViewer`**) = single **All cases** table, or **scoped** users get **Created by me** vs **Assigned / on my queues** (counts in headings). Optional **`?status=`** (validated by **`parseCaseListStatusParam`**) filters the list; Home status chart links here when the user cannot open Reports. **`EmptyState`** when no visibility or no rows for filter.
- List query uses `_count: { assets }` and loads only the **first** asset row for the primary name (ordered by `sortOrder`).

## App shell / primary navigation

- **Signed-in shell**: **`DashboardShell`** + **`DashboardSidebar`** + sticky **`DashboardTopBar`** (`src/components/layout/`) — **left** column (~`w-60`): accent bar, logo, product title/subtitle, pointer to header for identity, nav (**Home**, **Cases**, **Create request**, **Reports**), **Sign out**. **Main** column: **`DashboardTopBar`** shows **name**, **email**, **role badges**; when **`DEMO_MODE=true`**, a **Demo mode** persona dropdown calls **`demoSwitchPersonaAction`** (passwordless switch among allow-listed seed users). When **`DEMO_MODE`** is unset/false, no switcher UI and the action does not change sessions.
- **`src/app/(dashboard)/layout.tsx`**: wraps **`/cases`**, **`/cases/new`**, **`/cases/[id]`**, **`/reports`** — requires session (else redirect **`/`**); renders **`DashboardShell`** around children.
- **Signed-in `/`**: same **`DashboardShell`** from **`page.tsx`** so Home shares the same nav as dashboard routes. **Unsigned `/`**: no sidebar (marketing-style sign-in only).
- **Duplicate chrome removed**: case list and reports **`PageHeader`** no longer duplicate Reports / Cases / Home buttons; home signed-in view no longer duplicates those links (nav + Sign out only).

## Demo sign-in (`/` unsigned)

- **`src/lib/auth/demo-accounts.ts`**: allow-listed emails match **all** seeded demo users (**10** accounts). **`src/app/actions/auth.ts`**: **`bcrypt.compare`** against **`User.passwordHash`** (seed password **`Demo123!`**); optional **`demoSwitchPersonaAction`** when **`DEMO_MODE=true`**. On success, **`demoLoginAction`** and **`demoSwitchPersonaAction`** redirect to **`/`** (signed-in Home), not **`/cases`**. The home form includes user select + password; wrong credentials use the same generic error as unknown email (**`login=invalid`**). Add new seed emails to **`DEMO_LOGIN_ACCOUNTS`** or they cannot sign in.

## Home (`/`)

- **`src/app/page.tsx`**: signed-in branch loads **`listCasesVisibleToUser`** (same RBAC as list/detail), computes **`buildHomeKpiCounts`** (`src/lib/home/home-kpis.ts`), renders **`HomeKpiCards`** then **`HomeWorkDashboard`** inside **`DashboardShell`**; main column uses **`max-w-6xl`**. Above worklists, **`SignedInHomeBrandBanner`** (`src/components/branding/`) — compact hero: logo, **EoX Workflow Management Platform**, **Internal demo** badge, value line **Digitizing EoVSS / EoSM / ESS/MSS Request Management**. Header keeps **Home** title + signed-in identity line only (no RBAC explainer paragraph). **Unsigned** branch: page-level sky accent strip, logo + product line, **Demo workspace** heading, sign-in card with thin sky top rule (**`CiscoBrandLogo`** → **`/branding/cisco-logo.svg`**).
- **Home KPI strip** (**HomeKpiCards** + **buildHomeKpiCounts**): four equal-height metric cards (**Active cases**, **Pending your input**, **Pending input from others**, **Visible cases**). **Active** = visible cases whose status is not **`Closed`**, **`Rejected`**, or **`Cancelled`** (includes **`Draft`**; aligns with reports **active pipeline** / **`isNonTerminalCaseStatus`** in **`worklists.ts`**). **Visible** = count of **`listCasesVisibleToUser`**. **Pending your input** = distinct active (non-terminal) visible cases where **`filterCasesAwaitingMyInput`** matches (same **`canUpdateTask`** / multi-assignee rules as the **Cases awaiting my input** worklist). **Pending input from others** = active visible cases that have at least one **`isRunnable`** task with status neither **`Completed`** nor **`NotRequired`**, and that are **not** in the pending-your-input set (case-level; no double-count). Read-only leadership: pending-your-input count is **0** by design (**`filterCasesAwaitingMyInput`**).
- **Worklists** (`src/lib/home/worklists.ts` + **`userHasOperationalTaskTie`** / **`isUserDirectTaskAssignee`** in **`src/lib/tasks/direct-assignees.ts`**): **My active cases** = non-terminal and **`isWorklistInvolvement`** (same task-stake rules as **`myWorkCases`** on **`/cases`**: case owner, requester, case team, or **direct task assignee** / task team via shared helpers; CX / Platform Admin / Leadership = full visible portfolio). **Cases awaiting my input** = at least one open runnable task where **`canUpdateTask`** (uses **`TaskAccessRow.assigneeUserIds`** including multi-assignee). **Cases returned for more information** = `Awaiting Info` with involvement, or active **`AdditionalInfoRequest`** with **`userRelevantToInfoReturn`**. **`dedupeCasesById`** before cap: **one row per case per section** even if the user is assignee on multiple tasks. Each list capped at **10** rows. **`HomeWorkDashboard`** section descriptions still document portfolio vs scoped behavior.
- **Case status distribution**: **`CaseStatusDistribution`** — horizontal bars from **`caseStatusDistribution(visibleCases)`**. When **`canViewReports`** is true, each row is a **link** to **`/reports?status=…`** (same status filter as the reports GET form). Otherwise rows are plain text.

## Case detail UI

- `src/app/(dashboard)/cases/[id]/page.tsx`:
  - **Case summary**: Left column of the **top row** on **`lg`+** (`lg:grid-cols-2` with **Operations & assignment**); stacked above it on smaller viewports. **Order** (after compact metadata `dl`: Case ID, Service, Customer, optional Deal ID, Priority, Requester): **Business justification** → **Migration plan** (always shown; **`—`** when empty; same `Case.migrationPlan` field for all request types) → **Extension window** → **ESS/MSS-only** contextual card (subtype chip, optional timeline/target, hardware location, software & deployment — no duplicate migration body) → **Case totals** (bordered block: **Total BU cost**, **Total CX cost**, **Total quote value**, **Total units (qty)**; booking chip unchanged) → pointer to **Operations & assignment**, then optional **Partner** / **Coverage** / **Notes**. **Status** stays on **PageHeader**. **Platform financials** section unchanged below workflow.
  - **Operations & assignment** (merged): **Right column** of the same **top row** as **Case summary** on **`lg`+**; full width below summary on narrow screens. Read-only snapshot (**Created**, **Last updated**, **Requester email**, **Deal ID** as `—` until set, **Current owner**, **Assigned team**, **Routing note** from **`Case.routingNote`**) uses a **2-column** `dl` at `sm+` so it stays readable in the half-width column. **Case actions**: (1) **Case status** form (`updateCaseStatusAction`) with **Status change note** (required only for Blocked / Rejected / Cancelled); (2) **Queue, Deal ID & routing note** form (`updateCaseAssignmentAction`) for optional **`dealId`**, **`ownerId`**, **`assignedTeamId`**, optional persisted **`routingNote`**. **`canManageCaseOps`** gates both case-action forms, **Activate Additional Info**, **`TaskRowForm`** assignment pickers, and **Add task**. No separate **Routing / assignment** panel.
  - **Platforms & equipment**: Technical table (#, platform, software, **Quantity**, serials, EoL, HW LDOS) — separated from money; copy points readers to **Workflow / tasks** next, then **Platform financials** for BU/CX edits.
  - **Workflow / tasks**: Renders **after** **Platforms & equipment** and **before** **Platform financials** (**same page** for **EoVSS**, **EoSM**, **`ESS_MSS`**). Intro states **one shared task row** per line and that CX/Admin may manage multiple assignees. Tasks sorted via `sortCaseTasksForDisplay` in `src/lib/workflow/task-display.ts`. **Work item** column uses `taskWorkItemLabel` (task type + **platform name** for asset-scoped BU rows; **Eligibility review** appends the first line of **`notes`** for ESS/MSS scope). **Assignees** column: read-only rows use **`TaskAssigneeChips`** (sky-toned **`Badge`** chips via **`orderedTaskAssigneesForDisplay`** in **`assignment-display.ts`**). Editable assignees: **`TaskAssigneesEditor`** inside **`TaskRowForm`** — chips with remove (×), **+ Add assignee…** dropdown, hidden **`assigneeUserId`** fields on the row’s save form; dense rows omit the long “shared task” helper (it appears under **Add task**). **Team** column unchanged (queue context). First listed assignee remains **`Task.ownerId`** on save. BU/Finance without **`canManageCaseOps`** see assignees read-only in the editor (no add/remove). **# Days active** uses `daysActiveDisplay` (**`Not active`** until `isRunnable`, then whole days from `activatedAt`). **Read-only rows** (leadership or no task-edit permission): plain text status / chips / team / notes. Editable rows use **`TaskRowForm`**. Manual **Add task** uses form id **`add-case-task-form`** with **`TaskAssigneesEditor`** in an **Assignees (optional)** block; includes **`EligibilityReview`** in the type list.
  - **Activity log**: Each entry leads with **`ActivityLog.user`** display name, then a human verb from **`formatActivityAction`** (`src/lib/ui/format.ts` — e.g. `task_updated` → “updated a task”), then **`details`**. Copy notes that the named user is who performed the action at save time.
  - **Platform financials**: Card grid per asset via **`PlatformAssetCostEditor`** — **after** **Workflow / tasks**, **before** **Booking outcome** (only when **`assets.length > 0`**); live line total (BU+CX), optional 43% CX suggestion, **Save** posts to `updateCaseAssetCostsAction` when `canUpdateCase`; read-only cards otherwise. Editors remount when stored **`buCost`/`cxCost`** change (**React `key`** = asset id + costs). Copy points to **Case summary** for rolled-up totals. Standalone **`CaseFinancialSummary`** component is **unused** on this route (totals inlined in summary); kept in **`src/components/case/`** for reuse.
  - **Booking outcome**: Violet-bordered section — **after** workflow and platform financials. Read-only **status** always; **Not booked reason** snapshot **only** if status is `NOT_BOOKED` or `PASSED_OVER` (empty reason shows **`— (no reason recorded)`**, aligned with reports lost-opportunity labeling). Edits use **`BookingOutcomeForm`** with a **`key`** tied to server status/reason. `updateCaseQuoteBookingAction` + Zod unchanged.
  - External reference task pickers use the same **work item** labels (QUOTE/VAP/APAS only — **not** Salesforce IB).
  - **Salesforce IB Case** (`src/components/case/SalesforceIbCaseSection.tsx`): Orchestration-only surface — integration badge (Not Created / Ready / Created / Failed), SF identifiers when present, **Create** / **Retry** for **CX Ops** + **Platform Admin** when **`evaluateSalesforceIbCreationEligibility`** passes (submitted pipeline, Intake Validation completed, customer + justification + ≥1 platform line). Wired by **`createSalesforceIbCaseAction`** in **`src/app/actions/case-workspace.ts`**. When **`DEMO_MODE=true`**, optional expandable **provider payload** preview for narrator/debug.

## Salesforce IB — Phase 1 vs later production

This app remains an **orchestration layer**: it records linkage and drives **one-shot create/retry** through code behind **`getSalesforceIbProvider()`**. It does **not** run CCW/VAP/APAS/Salesforce workflow execution inside Salesforce.

**In Phase 1**

- Persist **`SALESFORCE_IB`** **`ExternalReference`** rows + **`ActivityLog`** (`salesforce_ib_create_attempt`, `salesforce_ib_created`, `salesforce_ib_create_failed`).
- **Mock provider** (default): deterministic SF-like Id and case number from public case id; optional **fail-first** id list for retry demos; **no outbound HTTP**.
- **`salesforce`** provider kind: validates env keys only, returns **`NOT_CONFIGURED`** or **`NOT_IMPLEMENTED`** — safe guardrail if someone flips the flag early.

**Intentionally out of scope (Phase 1)**

- OAuth/token refresh, Composite Case API implementation, webhooks, polling Salesforce for status, bidirectional sync.

**How mock mode works (local + EC2)**

- **`SALESFORCE_IB_PROVIDER` unset or `mock`**: Node loads **`createMockSalesforceIbProvider`** (`src/lib/integrations/salesforce-ib/mock-provider.ts`). Same code path in **`npm run dev`**, **`npm run start`**, and the Docker Compose **`app`** container — only **`DATABASE_URL`** / **`NODE_ENV`** differ per environment.
- **`SALESFORCE_IB_MOCK_STABILITY_SEED`**: optional string blended into mock Id derivation so reseeds stay repeatable.
- **`SALESFORCE_IB_MOCK_FAIL_FIRST_ATTEMPT_IDS`**: comma-separated **`caseId`** values whose **first** create fails; **retry** succeeds (seed **`EoVSS-2026-200015`** uses this story).
- **`SALESFORCE_IB_MOCK_INSTANCE_URL`**: base for fake deep links in mock responses.

**Plugging in the real Salesforce adapter later**

- Implement **`createIbCase`** inside **`createSalesforceRestProvider`** (`src/lib/integrations/salesforce-ib/salesforce-rest-provider.ts`) (or swap factory wiring — **`src/lib/integrations/salesforce-ib/factory.ts`** already selects by **`getSalesforceIbProviderKind()`**).
- Set **`SALESFORCE_IB_PROVIDER=salesforce`** and populate **`SALESFORCE_INSTANCE_URL`**, **`SALESFORCE_CLIENT_ID`**, **`SALESFORCE_CLIENT_SECRET`**, **`SALESFORCE_USERNAME`**, **`SALESFORCE_PASSWORD`** (names reserved in code today).
- **Unchanged** when this lands: eligibility checks, RBAC, **`mapEoXCaseToSalesforceIbPayload`**, Case Detail UX structure, idempotent **read-before-write** around **`ExternalReference`**, and activity semantics — only the provider body performs HTTP.

### Environment variables (Salesforce IB + demo/session)

| Variable | Role |
|----------|------|
| **`DEMO_MODE`** | Exactly **`true`** enables header persona switcher + relaxed persona-switch server action; unset/other = off (`src/lib/env/demo-mode.ts`). |
| **`COOKIE_SECURE`** | **`true`** behind HTTPS (typical EC2 pilot); aligns cookie flags in **`src/app/actions/auth.ts`**. |
| **`COOKIE_SAME_SITE`** | **`lax`** default; **`strict`** / **`none`** when appropriate (**`none`** requires **`COOKIE_SECURE=true`**). |
| **`SALESFORCE_IB_PROVIDER`** | **`mock`** (default) or **`salesforce`** (`src/lib/integrations/salesforce-ib/env.ts`). |
| **`SALESFORCE_IB_MOCK_STABILITY_SEED`** | Optional mock Id stability string. |
| **`SALESFORCE_IB_MOCK_FAIL_FIRST_ATTEMPT_IDS`** | Optional comma-separated public case ids for forced first-failure in mock. |
| **`SALESFORCE_IB_MOCK_INSTANCE_URL`** | Optional mock deep-link base URL. |
| **`SALESFORCE_INSTANCE_URL`** · **`SALESFORCE_CLIENT_ID`** · **`SALESFORCE_CLIENT_SECRET`** · **`SALESFORCE_USERNAME`** · **`SALESFORCE_PASSWORD`** | Reserved for future REST/OAuth implementation (`SALESFORCE_REST_CONFIG_KEYS` in **`salesforce-rest-provider.ts`**); no live calls today. |

Full table including **`DATABASE_URL`** / **`SESSION_SECRET`** remains in **`README.md`**.

### Run / reseed commands (unchanged for IB)

IB adds **no** new npm scripts. After pulling migrations:

1. **`npx prisma migrate deploy`** (or **`npm run db:migrate`** during schema work).
2. **`npm run db:seed`** — additive demo load on an empty or existing DB (does **not** wipe).
3. **`npm run db:reset`** or **`./scripts/demo-reset-local.sh`** — full wipe + migrate + seed (local).
4. Compose pilot: **`docker compose exec app npx prisma migrate reset --force`** or **`./scripts/demo-reset-docker.sh`** — same outcome inside **`app`**.

Console closes with a line naming IB demo cases — cross-check against **`prisma/seed.ts`** header table.

## Seed

- `prisma/seed.ts`: **10** users — **CX:** `cx.primary@local` (Jordan: CX + Account + Platform admin), `cx.priya@local`, `cx.luis@local`, `cx.inactive@local` *(no seeded workload)*; **general:** `sales.demo@local` (Alex), `account.maya@local`, `bu.demo@local`, `finance.demo@local`, `leader.demo@local`, `account.inactive@local` *(no seeded workload)*. **15** cases: **`EoVSS-2026-200001`–`200005`**, **`EoVSS-2026-200015`**, **`EoSM-2026-200006`–`200010`** (includes **Draft** `EoSM-2026-200010` for Maya **created-by** only), **`ESSMSS-2026-200011`–`200014`**. Teams: **CX Ops Global**, **BU Review Queue — AMER**, **Finance Approvers**, **Leadership**, **Platform Admin**. Multi-assignee on select tasks; refs QUOTE/VAP/APAS; comment + attachment on **`EoVSS-2026-200001`**. Zero-workload users stay **`isActive: true`** so sessions work; they have **no** cases as requester and **no** task assignee rows.

**Salesforce IB seed scenarios** (mock provider; see file header in **`prisma/seed.ts`**):

| Public case id | IB shape |
|----------------|----------|
| **`EoVSS-2026-200001`** | **`CREATED`** + post-seed **`ActivityLog`** attempt/success |
| **`EoSM-2026-200006`** | **`READY`** (no SF Id yet) |
| **`EoVSS-2026-200015`** | **`FAILED`** + attempt/failure activity; **Retry** succeeds |
| **`EoSM-2026-200008`** | **No** IB row — live **Create** demo for CX users |

## Reports dashboard (`/reports`)

- **Route**: `src/app/(dashboard)/reports/page.tsx` — gated by **`canViewReports`** (`CX_OPS`, `PLATFORM_ADMIN`, `LEADERSHIP_READONLY`, `BU_CONTRIBUTOR`, `FINANCE_APPROVER`); users without that permission are redirected to **`/`**. **Leadership** uses the same metrics as other report viewers but remains read-only elsewhere (`isReadOnlyDemoUser`); this page has no mutations. **`searchParams`** drive filters (GET); the page calls **`getReportsPageData(user, parseReportsFilters(sp))`**.
- **Copy**: Filter label **Service**; first option **All services**; GET field name remains **`requestType`** (values `all` / `EoVSS` / `EoSM` / `ESS_MSS`). **`parseReportsFilters`** also reads **`svc`** and **`service`** as aliases for the same enum filter. Segmentation section title **Service segmentation**; table first column **Service** (display via **`formatRequestType`** — third bucket **ESS/MSS**). Methodology references **per service**. Dashboard KPIs use financial rollups and case/task fields only — not **`partnerName`** or **`CaseAsset.quantity`**.
- **Data**: `listCasesForReports` loads **all `CaseAsset` rows**, **`Case.owner`** (id/name for filter labels), **task** fields (`type`, `status`, `isRunnable`, `activatedAt`, `createdAt`, **`TaskAssignee`** for visibility) plus visibility fields, then **`canViewCase`**. **`applyReportsFilters`** (`src/lib/reports/reports-filters.ts`) narrows by **`Case.requestType`** (Prisma enum), **case status**, **routing owner** (`ownerId` / unassigned), and **UTC date range on `Case.createdAt`**. **`parseReportsFilters`** maps legacy query value **`EoSS`** (e.g. old **`requestType=EoSS`**) to **`ESS_MSS`** for bookmarks. Rows whose `requestType` is outside **EoVSS / EoSM / ESS_MSS** are still counted in executive and financial totals but omitted from the three-row segmentation map (defensive). **`buildReportsPagePayload`** runs **`buildReportsDashboard`**, **`buildBottleneckModel`**, **`buildCaseStatusAging`**, **`buildTaskAging`**, and **`buildTimeSeries`** on the **same filtered array** so KPIs, segmentation, revenue, cycle metrics, bottlenecks, aging, and trends stay aligned.
- **UI**: `ReportsDashboardView.tsx` composes **`ReportsFilterForm`** (GET form), executive + methodology, revenue + **service segmentation** table (copy notes that **sum of per-service quote/BU/CX columns matches the overall row** for the active filter), **`ReportsBottleneckSection`**, **`ReportsAgingSection`**, **`ReportsTrendsSection`**, throughput table, lost opportunity.
- **Navigation**: **Reports** appears in the **left nav** when **`canViewReports`** (not separate header buttons). Home status chart links to **`/reports?status=…`** unchanged.

## Reporting (data layer)

- `src/lib/reports/case-financials.ts` re-exports rollup helpers; cross-case rollups are implemented in **`dashboard-metrics.ts`** (see above). SQL-style aggregates remain valid for future optimization.

## Build

`npm run build` passes (Prisma generate + `next build`).

## Demo database reset (wipe + reseed, no manual SQL)

Use this before a review or whenever the pilot DB has drifted. **Destructive:** drops the database contents Prisma manages, reapplies migrations from `prisma/migrations/`, then runs **`prisma db seed`** (wired in `package.json` → `prisma.seed`). Outcome is **deterministic**: same **10** users and **15** seeded cases from `prisma/seed.ts` every time. **Do not** use on shared or production Postgres.

### Local reset (PostgreSQL reachable from your machine)

**Prerequisite:** `DATABASE_URL` in repo-root `.env` (see `.env.example`). Postgres must be running (local install or `docker compose up postgres -d`).

```bash
cd /path/to/eox-workflow-demo
npm run db:reset
```

Equivalent wrapper (from repo root):

```bash
./scripts/demo-reset-local.sh
```

Prisma reads `.env` from the project root; no manual DB steps. Expect seed logs: **10** users, **15** cases, password **`Demo123!`**.

### EC2 / Docker Compose reset (app + Postgres via Compose)

**Prerequisite:** Stack is up (`docker compose up -d` or equivalent) and the **app** container is healthy.

```bash
cd /path/to/eox-workflow-demo
docker compose exec app npx prisma migrate reset --force
```

Equivalent wrapper:

```bash
./scripts/demo-reset-docker.sh
```

The container already has `DATABASE_URL` pointing at the `postgres` service; migrations and seed run inside **app** (same image as entrypoint `migrate deploy` + `next start`). **Restart not required** for the DB; the Next.js process keeps running. **Session cookies** may reference old user ids after reset — have reviewers **sign in again** (or use a private window).

### Before demo checklist

- [ ] Reset completed successfully (no Prisma errors; seed line shows **10** users / **15** cases).
- [ ] `SESSION_SECRET` is set to **32+** characters in `.env` (local) or Compose env (EC2).
- [ ] Optional pilot UX: `DEMO_MODE=true` only if you want the header persona switcher (see `README.md`).
- [ ] Browser: new private window or **Sign out** so stale sessions are not confused after a reset.
- [ ] Smoke: sign in as `cx.primary@local` with **`Demo123!`** → lands on **Home** (`/`); open **Cases** from the nav to see seeded public IDs (e.g. `EoVSS-2026-200001`).
- [ ] Optional IB smoke (**mock**, default): open **`EoSM-2026-200008`** → **Salesforce IB Case** → **Create** → row moves to **Created** with deterministic mock Id; open **`EoVSS-2026-200015`** → **Retry** after failed state.

## Commands after pull

1. Ensure **PostgreSQL** is running and `DATABASE_URL` in `.env` points at it (see `.env.example`).
2. `npx prisma migrate deploy` — apply migrations (recommended for CI/EC2 and local parity). For local iterative schema work, `npm run db:migrate` (`prisma migrate dev`) is fine.
3. **`npm run db:seed`** — (re)load demo data **without** wiping (empty DB or additive refresh). For a **full** wipe + seed, use **`npm run db:reset`** or the scripts above instead.

**Docker Compose:** `docker compose up --build` runs **`migrate deploy`** on app startup. For a full demo reset in pilot environments, use **`docker compose exec app npx prisma migrate reset --force`** or **`./scripts/demo-reset-docker.sh`** (see **Demo database reset**). Never run reset against shared or production databases.

## Consistency audit (ESS/MSS + EoSM + optional partner fields)

Cross-repo check: Third bucket is **ESS/MSS** in UI, **`ESS_MSS`** in Prisma, public IDs **`ESSMSS-…`**. **EoSM** is **End of Software Maintenance** in product UI (`REQUEST_TYPE_INTAKE_HINT`, intake page, case detail, reports). **Partner name** optional for **all** services; **quantity** optional per **`CaseAsset`** row (non-negative when set). Case detail labels populated partner blocks **(optional)**. Intake review echoes per-platform quantity when set. **`EoSS`** string remains only for **legacy bookmark / migration** handling (see **Remaining `EoSS` references** in `docs/PRODUCTION_NOTES.md`). Negative guidance on mislabeling EoSM lives in `docs/PROJECT_CONTEXT.md` / `PRODUCTION_NOTES.md` (not duplicated in every UI string).
