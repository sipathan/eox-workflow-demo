# Implementation decisions

## Case public ID

- Use a **stable type token** per `RequestType`: **`EoVSS`**, **`EoSM`**, and **`ESSMSS`** for enum **`ESS_MSS`** (see `publicCaseIdTypeToken` in `src/lib/cases/case-id-prefix.ts`). Public IDs read as `EoVSS-2026-…`, `EoSM-2026-…`, `ESSMSS-2026-…`.
- Uniqueness: collision-resistant random suffix with a small retry loop (`generateUniqueCaseId` in `src/app/actions/cases.ts`).

## Deal ID optional

- Intake: optional; stored as `null` when blank (`toCaseWriteData` uses `(data.dealId ?? "").trim()`).
- Post-intake: **CX Ops** and **Platform Admin** can set or clear Deal ID from the **Operations & assignment** panel (`updateCaseAssignmentAction` + `caseAssignmentUpdateSchema`). **Case summary** also shows **Deal ID** read-only for quick scan (same `Case.dealId` field). There is no separate “CLO” role in this demo; behavior is documented as CX/Admin.

## Case routing note (`routingNote`)

- **`Case.routingNote`**: optional text for CX routing / handoff context (separate from intake **`Case.notes`**). Editable only via **`updateCaseAssignmentAction`** with the same gates as owner/team/Deal ID. Empty submit clears to **`null`**. Migration **`20260503120000_case_routing_note`** adds the column.

## Request types and intake (EoSM / ESS/MSS / partner optionality)

- **Naming**: Prisma **`RequestType`**: **`EoVSS`**, **`EoSM`**, **`ESS_MSS`**. UI / marketing strings use **ESS/MSS** for the third bucket (`REQUEST_TYPE_LABEL` / shell copy). Do not reintroduce **`EoSS`** as an enum value; SQL migration maps legacy rows to **`ESS_MSS`** / **`ESSMSS-…`** IDs.
- **Intake step 0**: User-facing heading **Service** (radio group still binds **`requestType`**). **Create request** page copy states public IDs use **`EoVSS-`**, **`EoSM-`**, or **`ESSMSS-`** prefix from the selected service.
- **EoSM** means **End of Software Maintenance** in all product copy (`docs/PROJECT_CONTEXT.md`, **`REQUEST_TYPE_INTAKE_HINT`**, intake UI, reports). It marks the end of **regular software maintenance** and **routine bug fixes** for the product in scope. It does **not** mean “service migration” or any separate “Service Migration” product line — do not conflate wording.
- **EoVS / EoVSS**: **security vulnerability fixes** may continue on a separate track after the EoSM milestone per official policy; behavior is **product-dependent** (documented for demo accuracy only).
- **`migrationPlan`** in Prisma is optional free text for **EoVSS** / **EoSM**; the intake UI labels it **Supporting details (optional)** for those types. For **`ESS_MSS`**, the same column stores the **required** migration-plan narrative on submit (labeled in the ESS/MSS intake block). The field name remains legacy; product copy does not equate it with “service migration” for **EoSM**.
- **`ESS_MSS`**: `EssMssSupportSubtype`, hardware/software conditional validation, software declaration booleans + `environmentIsProduction`, and `essEligibilityAcknowledged` when the submitter confirms non-compliant or non-production scope — structured for MSS team review later, not hard workflow gates beyond intake validation.
- **`partnerName`** is **never required** on submit for any **`RequestType`**; it **must not** block **draft save**, **submit**, or **other case-update actions** (assignment, booking, asset costs, tasks, etc.). Intake shows **Partner (optional)** (name only). Case detail shows a partner snapshot only when **`partnerName`** is populated; the section header includes **(optional)** when shown.
- **`quantity`**: Stored on **`CaseAsset`** only (optional per platform line). Zod **`caseAssetRowSchema`** uses a **non-negative** integer when the user enters a number (empty string → unset). Prevents spurious submit failures on `0` while still rejecting negatives. Legacy **`Case.quantity`** was removed; migration **`20260530191500_quantity_on_case_asset`** copies old case-level values to the **first** asset row by **`sortOrder`** only when a legacy value existed (multi-asset cases are ambiguous — correct per line in the UI if needed).
- **`REQUEST_TYPE_INTAKE_HINT`** (`src/lib/ui/format.ts`): EoVSS line states partner is optional and quantity is per platform; EoSM line states End of Software Maintenance and maintenance vs security; ESS/MSS line leads with **ESS/MSS**, ESS-oriented scope today, future MSS headroom, optional partner and per-line quantity (none of these blurbs equate EoSM with service migration).

## Multi-platform data

- **`CaseAsset`** is the canonical place for per-platform serials, EoL link, HW LDOS, software version, and optional **quantity**.
- **EoVSS / EoSM submitted tasks**: **`buildSubmittedCaseTaskRows`** in **`src/lib/workflow/task-templates.ts`** creates **per-asset** BU Review and BU Pricing, then case-level Quote / VAP / Flag / Additional Info.
- **ESS/MSS (`ESS_MSS`) submitted tasks**: same entrypoint — **no** BU rows; **one or two** case-level **`EligibilityReview`** tasks with **`notes`** set from **`essSupportSubtype`** (hardware-only, software-only, or hardware + software lines). Then Quote / VAP / Flag / Additional Info. MSS-only steps can branch inside this module later without changing EoVSS/EoSM.

## Default tasks and activation

- On submit, existing tasks are replaced; `bootstrapSubmittedCaseTasks` in **`src/app/actions/cases.ts`** passes **`requestType`** and **`essSupportSubtype`** into **`buildSubmittedCaseTaskRows`** (activation rules are **not** run inside that transaction).
- **EoVSS / EoSM chain** (`applyTaskActivationRules` in **`src/lib/workflow/task-activation.ts`**): Intake terminal → BU Reviews runnable; all BU Reviews terminal → BU Pricings runnable; **Quote runnable** when all BU Pricings terminal **or** (no BU pricing rows and) all **EligibilityReview** rows terminal — the latter covers ESS-only cases; **Quote** terminal → **VAP** → **Flag**.
- **ESS/MSS chain**: Intake terminal → **all EligibilityReview** rows runnable together; when **all** are terminal, **Quote** opens (same gate as above when there are zero BU Pricing rows).
- **Additional Info Request**: created **inactive** (`isRunnable: false`, `isRequired: false` by default). CX/Admin can activate via **`activateAdditionalInfoTaskAction`** (sets `isRunnable`, `activatedAt`, `isRequired`).

## RBAC and runnable tasks

- `TaskAccessRow` includes `isRunnable`. Non–CX/Admin users cannot update tasks when `isRunnable` is false (`canUpdateTask` in `src/lib/rbac.ts`).

## Case detail presentation

- **Top row layout**: On **`/cases/[id]`**, **Case summary** and **Operations & assignment** sit in one responsive grid: **stacked** (single column) below the `lg` breakpoint, **two columns** (`lg:grid-cols-2`, summary left / operations right) on large screens. Both sections use **`min-w-0`** so nested grids do not overflow the column.
- **Case totals in summary**: **Total BU**, **Total CX**, and **Total quote value** in **Case summary** use the same **`rollupCaseFinancials`** (`src/lib/cases/financials.ts`) as reports and the former standalone summary — always rendered (zero assets → zeros). Per-line editing remains only under **Platform financials**.
- **Booking “not updated” chip**: In **Case summary**, **`isBookingCommercialFinalized`** treats the booking line as finalized when **`Case.quoteBookingStatus !== OPEN`** *or* **`Case.status`** is **Closed**, **Rejected**, or **Cancelled** (terminal outcomes still show the chip as the current **`formatQuoteBookingStatus`** label, not “not updated”). Independent of whether platform costs are filled in.
- **Operations & assignment vs workflow**: The **Operations & assignment** section owns the narrative and snapshot for **case** owner, **team queue**, **Deal ID**, and optional **`routingNote`**, plus case status transitions. The **Workflow / tasks** table owns **task-level** work. **Case summary** includes a pointer to Operations & assignment and mirrors **Deal ID** read-only when populated.
- **Task ordering**: `sortCaseTasksForDisplay` orders by canonical workflow type sequence (**EligibilityReview** sits after Intake, before BU), then by `caseAsset.sortOrder`, then by **`task.id`** for stable ordering when multiple rows share the same type (e.g. dual eligibility on ESS hardware+software).
- **Work item labels**: `taskWorkItemLabel` = `formatTaskType` + ` · ` + platform name when `caseAsset` is set; for **`EligibilityReview`**, first line of **`notes`** is appended so hardware vs software rows are distinguishable in the table.
- **Days active**: `daysActiveDisplay` returns **`Not active`** when `isRunnable` is false; otherwise whole days since `activatedAt` (or `—` if runnable but missing timestamp).
- **Read-only task rows**: When `readonly || !canUpdateTask`, the page renders static cells (no `TaskRowForm`); escalation lines appear only if `blockerReason` / `notRequiredReason` are non-empty. Editable rows keep `TaskRowForm` conditional blocker/not-required fields tied to status dropdown.

## Types: CaseAsset batch create

- `assetRowsFromSubmit` returns `Omit<Prisma.CaseAssetCreateManyInput, "caseId">[]` because `caseId` is supplied when creating rows in `replaceCaseAssets` (satisfies Prisma 6 typing).

## Demo vs production

- Activation logic is intentionally small and synchronous (re-read tasks in a short loop). Good enough for demo-scale Postgres; production would likely use explicit workflow state or a rules engine.

## PostgreSQL + Docker Compose (internal pilot)

- **Prisma** `datasource` is **PostgreSQL**; `DATABASE_URL` is the only connection string (local Postgres, Compose service `postgres`, or RDS later).
- **Migrations:** SQLite-era migration folders were removed and replaced by a **single baseline** `prisma/migrations/20260530120000_init_postgresql` generated from the current `schema.prisma` (`prisma migrate diff --from-empty …`). New environments run **`prisma migrate deploy`** (Compose entrypoint runs this before `next start`).
- **Runtime:** `Dockerfile` (multi-stage build) + `docker-compose.yml` (app + Postgres 16, named volume). Postgres publishes **`5432:5432`** for **host** access (Prisma / `npm run dev`); the **app** service still uses **`postgres:5432`** on the Compose network. **`docker-entrypoint.sh`**: `migrate deploy` → `npm run start`. Demo auth unchanged.
- **Seed:** not run automatically in Compose; operators run `docker compose exec app npx prisma db seed` when they want demo data.

## Platform financials (demo USD)

- **`CaseAsset.buCost`** and **`CaseAsset.cxCost`** are stored as non-negative **Float** (PostgreSQL `DOUBLE PRECISION`); demo treats values as **USD** with two decimal display via `formatUsd2` (`src/lib/ui/format.ts`).
- **Line total** is never stored: **`platformTotalCost(bu, cx)`** = `roundMoney2(bu) + roundMoney2(cx)` in `src/lib/cases/financials.ts`.
- **Case rollups** (`totalBuCost`, `totalCxCost`, `totalQuoteValue`) are **derived** in app code with **`rollupCaseFinancials`** over the case’s assets (sum of rounded line totals for `totalQuoteValue`).
- **Intake**: optional per-row costs in `caseAssetRowSchema`; **`suggestedCxCostFromBu`** (43% of BU, rounded) is exposed only as a **button** on new request — not enforced server-side.
- **Persistence**: `replaceCaseAssets` / `assetRowsFromSubmit` in `src/app/actions/cases.ts` write `buCost` / `cxCost` / optional **`quantity`**. **`updateCaseAssetCostsAction`** updates a single asset when `canUpdateCase` passes (costs only; quantity is intake-only in this demo).

## Quote booking (case-level)

- **`Case.quoteBookingStatus`** + **`notBookedReason`**. **`caseBookingUpdateSchema`** requires a trimmed reason when status is `NOT_BOOKED` or `PASSED_OVER`; server clears `notBookedReason` when moving to `OPEN` or `BOOKED`.
- **`updateCaseQuoteBookingAction`** in `src/app/actions/case-workspace.ts` (same `canUpdateCase` gate as other case mutations). Activity: `quote_booking_updated` / `asset_costs_updated`.
- **Case Detail UX**: Any non-**OPEN** **`quoteBookingStatus`** counts as “booking updated” for the **Case summary** chip (alongside terminal **Closed** / **Rejected** / **Cancelled**). **`OPEN`** with a non-terminal case shows **Booking not updated** — purely booking state, not financial completeness.

## Reports dashboard KPIs (`/reports`)

- **Scope**: Every metric uses the same **filtered cohort**: **`listCasesForReports`** ( **`canViewCase`** as the case list), then **`applyReportsFilters`** from URL params (see **Reports filters and operational extensions** below).
- **Total / active / closed case counts**: **Total** = rows in scope. **Active** = status is not `Closed`, `Rejected`, or `Cancelled` (Draft and in-flight pipeline count as active). **Closed** = `status === Closed` only (Rejected/Cancelled are not counted as closed wins).
- **Financials**: Per case, **`rollupCaseFinancials(assets)`** — **total quote value** = sum of rounded line totals (BU+CX per `CaseAsset`); **total BU** / **total CX** = sums of stored component columns. Dashboard **overall** and **service segmentation** rows (per **`RequestType`**: EoVSS, EoSM, **`ESS_MSS`** / UI **ESS/MSS**) sum those case-level rollups across the scoped set.
- **Average quote value**: `totalQuoteValue ÷ caseCount` in the relevant scope (overall or per **service**). Cases with zero assets contribute **0** to the numerator but still count in the denominator — documented on the Reports UI.
- **Average cycle time**: Only for **`status === Closed`**. Elapsed days = **`(updatedAt - createdAt) / 86_400_000`**, clamped at ≥ 0. **Assumption**: there is no **`closedAt`** field; **`updatedAt`** is used as the close snapshot for both the average and **monthly throughput** buckets (month = UTC `YYYY-MM` from `updatedAt`). Any post-close metadata edits would shift this in edge cases.
- **Cases closed per period**: Count of scoped cases with `status === Closed`, grouped by UTC month of `updatedAt`.
- **Lost opportunity**: Counts split **`NOT_BOOKED`** vs **`PASSED_OVER`**; **`byReason`** groups trimmed **`notBookedReason`**, with empty/null reasons labeled **`— (no reason recorded)`**.

## Reports filters and operational extensions (`/reports`)

- **Filters** (query params parsed in **`parseReportsFilters`**): **`requestType`** (GET form field name; `all` or `EoVSS` / `EoSM` / `ESS_MSS`; legacy **`EoSS`** is accepted and mapped to **`ESS_MSS`**). Aliases **`svc`** and **`service`** read the same service filter value. **`status`** (`all` or any **`CaseStatus`**), **`ownerId`** (`all`, **`__unassigned__`**, or a user id for **`Case.ownerId`** / routing owner), **`dateFrom`** / **`dateTo`** as **`YYYY-MM-DD`** interpreted as **UTC start/end of day** on **`Case.createdAt`**. Owner pick-list is built from **all** `canViewCase`-visible cases (not the filtered subset) so names stay available. Clearing filters uses **`/reports`** with no query string. Reports UI labels the control **Service**; segmentation table title **Service segmentation** (three rows: EoVSS, EoSM, ESS/MSS).
- **Bottlenecks**: **Cases by status** = histogram of **`Case.status`**. **Blocked** = count where **`Case.status === Blocked`**. **Awaiting BU / eligibility / VAP / flag removal** = **distinct cases** with at least one **`isRunnable`** task whose **`status`** is not **`Completed`** or **`NotRequired`**, and whose **`type`** is in **`BUReview`+`BUPricing`+`EligibilityReview`**, **`VAPTracking`**, or **`FlagRemovalTracking`** respectively. **Top bottleneck** = the largest count among blocked + those three signals (ties favor the first in that ordered list).
- **Case-status aging**: For each **current** `Case.status` bucket among filtered cases: **average days** = mean of **`updatedAt − createdAt`** for **terminal** statuses (`Closed` / `Rejected` / `Cancelled`), else mean of **`reportRunTime − createdAt`** for in-flight cohorts (documented on the page).
- **Task aging**: Only **open runnable** tasks (`isRunnable` and not completed / not required). Per **`TaskType`**, average age = **`now − activatedAt`** when **`activatedAt`** is set, else **`now − task.createdAt`**.
- **Time series (UTC month `YYYY-MM`)**: **Cases created** and **revenue** bucket by **`Case.createdAt`** month (revenue = sum of **`rollupCaseFinancials`** for cases created that month). **Cases closed** bucket **`Closed`** cases by **`Case.updatedAt`** month (same close proxy as cycle KPIs).

## Primary navigation (demo shell)

- **Config**: **`getPrimaryNavItems()`** in **`src/lib/navigation/app-nav.ts`** — order **Home → Cases → Create request → Reports**; each item has **`visible(user)`** and **`isActive(pathname)`**.
- **Sign out**: Rendered in **`DashboardSidebar`** immediately after the filtered primary links (not in **`app-nav`** — it is not a route). A **top border + vertical spacing** separates it from route links so it reads as a **session action**; styling stays lighter than primary **`Link`** rows and never participates in active-route logic.
- **Create request**: **`canCreateRequest`** in **`src/lib/rbac.ts`** — same rule as **`NewCasePage`**: Account Team, CX Ops, or Platform Admin, excluding read-only leadership; BU/Finance do not get the nav item (they can still be deep-linked if needed; page shows empty state).
- **Reports**: **`canViewReports`** unchanged (Account Team excluded).
- **Layout split**: **`(dashboard)/layout.tsx`** provides the shell for all dashboard routes; **`/`** when signed in wraps the same shell in **`page.tsx`** so behavior matches without nesting route groups under `/`.

## Branding (demo shell & marketing-lite surfaces)

- **Logo file**: **`public/branding/cisco-logo.svg`** — Cisco wordmark **SVG** from [Wikimedia Commons — File:Cisco_logo.svg](https://commons.wikimedia.org/wiki/File:Cisco_logo.svg) (vendored copy; comply with Commons license + Cisco trademark policy for your use case). **`CiscoBrandLogo`** loads **`/branding/cisco-logo.svg`** with intrinsic **`width`/`height`** from the asset (`72×38`), **`object-contain`**, and **`alt="Cisco"`**. See **`public/branding/README.md`** for source URL and replacement notes.
- **Shell**: **`DashboardSidebar`** carries logo + full product title + compact subtitle + user; **`DashboardShell`** main pane is **`bg-white`** for a clean operational canvas.
- **Signed-in Home**: **`SignedInHomeBrandBanner`** — restrained card (top gradient rule, white body, sky badge) so the hero does not dominate worklists.
- **Login (`/` unsigned)**: Lighter treatment only — accent strip, logo + product copy, existing form; no new auth logic.
- **Metadata** (`root layout`): title/description aligned with product naming for browser chrome.
