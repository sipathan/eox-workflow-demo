# Open items

## Product / UX

- **Left nav mobile**: sidebar is always visible (fixed width); add a collapse / drawer pattern for small viewports if demos need it. (Sign out now sits under the primary links with a divider — long-page reach is no longer an issue.)
- **Home worklists**: the same case may still appear in more than one home section (e.g. active + awaiting input); the **case list** page dedupes “My work” vs “Other visible.” Add cross-section deduping on home only if product wants a stricter inbox model.
- **Intake review step**: the final review panel does not yet echo per-platform **BU/CX/totals**; add a short financial summary there if leadership wants costs visible before submit. Partner line is omitted when blank; platform summary includes **quantity** per row when set. **ESS/MSS**: review shows subtype, migration plan (wrapped), timeline, and optional hardware/software lines when present.
- **Quantity helper (future)**: optional suggestion of **quantity** from parsed serial-number count (user-editable override) was deferred; document if product wants it later.
- **“Days active”**: case detail shows **`Not active`** until `isRunnable`; then counts whole days from `activatedAt` (`daysActiveDisplay`). If activation logic ever **rewrites** `activatedAt` on already-active tasks, the metric could reset — review `applyTaskActivationRules` if that becomes a problem.
- **Case list at very large asset counts**: list loads **asset count** plus **one** primary platform name; if you need full platform names in the queue, extend the query or add a hover API.
- **ESS_MSS / EoSM asset rows**: intake allows multiple platform cards for all request types; constrain to a single row or different copy only if product asks.

## Technical

- **Case detail layout**: **`/cases/[id]`** places **Case summary** and **Operations & assignment** side by side from **`lg`**, stacked on smaller viewports. **Case summary** leads with business context (**Business justification**, **Migration plan**, **Extension window**, then ESS/MSS-only extras when applicable) before **Case totals** (rollup BU/CX/quote + units + booking chip). Then **Platforms & equipment**, **Workflow / tasks**, **Platform financials** (when assets), **Booking outcome**, then external references / comments / activity / attachments. Same high-level order for all **`RequestType`** values. **`canManageCaseOps`** gates the ops panel and related task controls. Intake **`notes`** and CX **`routingNote`** stay distinct columns.
- **ESS/MSS naming (demo)**: Intake step 0, case summary (`/cases/[id]`), case list, home work rows, and reports filters use the **Service** label where users pick or read **EoVSS / EoSM / ESS/MSS**; wire field and Prisma enum stay **`requestType`** / **`ESS_MSS`**. Public case IDs use **`ESSMSS-`** (no slash).
- **ESS/MSS workflow**: submitted cases use **`EligibilityReview`** (1–2 rows by subtype) instead of BU review/pricing; activation and reports treat eligibility as pre-quote work alongside BU tasks. Further MSS subflow branching can extend **`task-templates.ts`** only.
- **Draft with no named platforms**: draft save stores **zero** `CaseAsset` rows until at least one card has a platform name; submit still requires **≥1** valid row with name (and EoVSS serials). UX now states this in the draft banner.
- **Reports dashboard**: filters (GET **`requestType`**, aliases **`svc`** / **`service`**), bottlenecks, aging, and month bar trends are in place. UI uses **Service** / **service segmentation** with three buckets **EoVSS**, **EoSM**, **ESS/MSS** (Prisma **`ESS_MSS`**); legacy **`EoSS`** query values map to **`ESS_MSS`**. Optional follow-ups: a real **`closedAt`** (or activity-derived) timestamp for cycle time, richer charts (client library), date filter on close vs create as a second mode, and SQL-side aggregates at scale.
- **Prisma 7**: deprecation notice for `package.json#prisma` — migrate to `prisma.config.ts` when upgrading.
- **Postgres / Docker:** pilot uses `docker-compose.yml` + named volume; **`postgres` publishes `localhost:5432`** for local development (host Prisma / Next dev). Tighten image size (e.g. production-only deps, `standalone` output) if the deployment graduates beyond a single EC2 demo; consider **dropping the `ports:`** mapping on Postgres if a host must not expose the DB.

## Docs

- `docs/PROJECT_CONTEXT.md` still lists legacy case-level **platform** / **softwareVersion** in **Core Case Data Fields** alongside **CaseAsset**-first implementation; a fuller editorial pass could align that section with the current schema (optional cleanup only).
- **EoSM** (**End of Software Maintenance**) and **partner optional for all types / never blocks create or update** are spelled out in `PROJECT_CONTEXT.md`, `HANDOFF_CURRENT_STATE.md`, `IMPLEMENTATION_DECISIONS.md`, and `PRODUCTION_NOTES.md`. **Quantity** is documented and implemented as **per `CaseAsset`**; case detail **Case summary** includes a null-safe **Total units (qty)** rollup. **`REQUEST_TYPE_INTAKE_HINT`** includes per-platform quantity for **EoVSS** / **EoSM** / **`ESS_MSS`** where relevant.
- **Brand asset**: logo is **`public/branding/cisco-logo.svg`** (Commons-sourced wordmark). If your org requires **internal-only** brand files, overwrite that path with approved artwork and keep **`CiscoBrandLogo`** unchanged.
