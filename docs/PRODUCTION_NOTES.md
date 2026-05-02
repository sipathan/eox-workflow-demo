# Production notes (contrast with this demo)

## Product terminology (carry forward to any fork)

- **Request types** — Prisma / API: **EoVSS**, **EoSM**, **`ESS_MSS`**. Human-facing UI and analytics labels for the third bucket: **ESS/MSS**; public case ID prefix **`ESSMSS`**. Legacy **EoSS** must not be reintroduced as a stored enum; migrations may still mention it when rewriting old rows.
- **EoSM** means **End of Software Maintenance**: end of **regular software maintenance** and **routine bug fixes** for the product in scope. Do **not** describe EoSM as **Service Migration** or imply a separate “service migration” offering when defining this type.
- **EoVS / EoVSS**: **security vulnerability fixes** may continue after EoSM per policy; timelines are **product-dependent** and are distinct from day-to-day EoSM maintenance windows.
- **Partner name** (`partnerName`): **optional for every request type**; it **must not** gate **request creation** or **case updates** in app validation or server actions in this codebase.
- **Quantity** (`CaseAsset.quantity`): **optional per platform line**; same non-gating rule. There is **no** case-wide quantity column in the current schema. The demo **Case summary** may show **Total units (qty)** as the **sum** of set line quantities (`totalQuantityFromAssets` in `src/lib/cases/financials.ts`); **`—`** when no line has a value — reports do not depend on this field.

### Remaining **`EoSS`** string references (intentional)

- **`src/lib/reports/reports-filters.ts`** — accepts legacy query value **`EoSS`** and maps it to **`ESS_MSS`** so old **`/reports?requestType=EoSS`** bookmarks keep working.
- **`prisma/migrations/20260502003859_ess_mss_request_type/migration.sql`** — rewrites historical **`EoSS-…`** public case IDs to **`ESSMSS-…`** and enum **`EoSS`** → **`ESS_MSS`**.
- **Docs** (`PROJECT_CONTEXT.md`, `HANDOFF_CURRENT_STATE.md`, `IMPLEMENTATION_DECISIONS.md`, `OPEN_ITEMS.md`, this file) — mention **`EoSS`** only as **legacy / forbidden in new code**, not as a current product label.

There is **no** `RequestType.EoSS` in the Prisma schema after migration; do not reintroduce it.

**Audit note:** Product-facing strings avoid describing EoSM as “service migration”; negative guidance stays in canonical docs. SQL migration files still contain the column name `migrationPlan` (legacy) — that is not user-facing copy.

---

This application is a **local prototype**. The following is **not** production-ready:

- **SQLite** file database — fine for a laptop demo; production would use a managed RDBMS, backups, and migration governance.
- **Local password login** — demo users in seed; no SSO, MFA, or enterprise directory.
- **Session / cookies** — implement per your org’s security baseline before any real deployment.
- **Task activation** — synchronous Prisma updates in a loop; acceptable at demo scale only.
- **No real integrations** — quote/VAP/APAS references are metadata only.
- **Reports (`/reports`)** — in-memory aggregation over all cases visible to the user, then URL-driven filters. Fine for demo volumes; production would move rollups to SQL/OLAP, add indexed date columns (**`closedAt`**), cache, and pagination for filter option lists.
- **UI consistency pass** — case list avoids duplicate rows between “My work” and the rest; home status chart deep-links to reports for report-capable roles; booking/financial client forms rely on **`key`** remounts instead of syncing props in **`useEffect`** (keeps React Compiler / ESLint clean). **Reports** and **case list** use **Service** / **ESS/MSS** display labels; Prisma field remains **`requestType`**. Case detail: **Deal ID** in **Case summary** only when populated; **Operations & assignment** snapshot uses trimmed Deal ID / routing note; **Status** not triple-shown (header vs summary vs ops).
- **No enterprise BI** — beyond `/reports`, production would still use a dedicated analytics stack on top of **`CaseAsset`** and task models.
- **Demo financials** — `buCost` / `cxCost` are `REAL` floats in SQLite, not a hardened ledger; use integers/minor units, currency metadata, and audit trails in any real deployment.

## If you ever harden this codebase

- Replace SQLite; enforce TLS; externalize secrets; add observability, rate limits, and CSRF strategy consistent with your hosting.
- Revisit **`applyTaskActivationRules`** for idempotency and for whether `activatedAt` should be set only on the first transition to runnable.
- Add automated tests for intake validation, task activation order, and RBAC on non-runnable tasks.

## Database reset (demo only)

**SQLite `DATABASE_URL`:** Prisma resolves relative paths from the **`prisma/`** directory (where `schema.prisma` lives). Use **`file:./dev.db`** in `.env` so the database file is **`prisma/dev.db`** at the repo root. A value like **`file:./prisma/dev.db`** incorrectly resolves to **`prisma/prisma/dev.db`**, which is easy to leave empty while migrations/seeds target a different file — the app then shows **no cases**.

For developers:

```bash
npx prisma migrate reset
```

This **drops** the SQLite database, reapplies all migrations, and runs `prisma/seed.ts`. Use when schema or seed changed and you want a clean slate. **Do not** use `migrate reset` against a shared or production database.

After pulls that change **seed copy** (EoSM terminology, optional partner rows) or **Prisma `///` comments** only, you can run **`npm run db:seed`** if the DB already exists and you want refreshed demo rows without a full reset; use **`migrate reset`** when you also need a clean file DB or applied migrations changed.

**Reports / intake UI wording**: filters, segmentation, **Create request** step 0, intake review, and **case summary** use the **Service** label for the three buckets (**EoVSS · EoSM · ESS/MSS**). **EoSM** is still documented everywhere as **End of Software Maintenance** (not service migration). Wire / Prisma field remains **`requestType`**.

**Case detail**: **Operations & assignment** consolidates operational metadata and CX edits; **`Case.notes`** = intake internal notes; **`Case.routingNote`** = optional CX routing note (do not overload **`notes`** for routing). CX/Platform-only controls share one **`canManageCaseOps`** check on the case page (status, queue/Deal ID/routing note, task assignment pickers where applicable, Add task).
