# EoX Workflow Management Platform (Demo)

Leadership-ready demo for queue-driven EoX request management:

- role-based visibility and actions
- team/queue + individual ownership model
- operational case workspace (tasks, references, comments, activity)
- executive reports with filters and charts

> **Demo disclaimer:** this app uses synthetic sample data and local credentials only.

**Product shorthand:** **EoSM** = **End of Software Maintenance** (see `docs/PROJECT_CONTEXT.md`). Third service bucket: **ESS/MSS** in UI, **`ESS_MSS`** in Prisma, public case IDs **`ESSMSS-…`**. **Partner name** is **optional for every service**. **Quantity** is optional **per platform line** (`CaseAsset`) and is not required to submit or update a case in this demo.

## Stack

- Next.js App Router + TypeScript
- Prisma ORM + **PostgreSQL**
- Tailwind CSS
- React Hook Form + Zod
- Recharts

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string for Prisma (see `.env.example`). |
| `SESSION_SECRET` | Secret used to sign demo session cookies (**32+ characters** recommended for shared or EC2 hosts). |
| `DEMO_MODE` | Optional. Set to exactly `true` to show the **demo persona switcher** in the signed-in dashboard header (see below). Any other value or unset = **disabled** (no switcher UI; server ignores persona-switch requests). |
| `COOKIE_SECURE` | Set `true` behind HTTPS (typical EC2 behind TLS). |
| `COOKIE_SAME_SITE` | `lax` (default), `strict`, or `none` (requires `COOKIE_SECURE=true`). |

Copy `.env.example` to `.env` and set values before running migrations or the app.

### Demo persona switcher (`DEMO_MODE=true`)

Cisco SSO is out of scope for this pilot, so when you need **fast persona changes during a live demo**, enable demo mode:

- **What it does:** After normal sign-in, the dashboard shows your **name**, **email**, and **role badges** in a sticky header, plus a **Demo mode** dropdown listing all **10 seeded users**. Choosing a user **re-issues the session cookie** for that account **without** re-entering the password.
- **Security:** The switcher is **not rendered** and the server action **no-ops** (redirects without changing the session) unless `DEMO_MODE` is exactly `true`. Password login and session signing are unchanged. **Do not enable** on internet-facing production; use only for **local** or **internal EC2** pilots where this trade-off is acceptable.

**Local (`npm run dev`):** add to `.env`:

```bash
DEMO_MODE=true
```

Restart the dev server, sign in once with `Demo123!`, then use the header dropdown to jump between personas.

**Docker Compose (laptop or EC2):** in the same `.env` file Compose reads from the repo root:

```bash
DEMO_MODE=true
SESSION_SECRET=<strong-32+-char-secret>
```

For EC2, prefer **HTTPS** in front of the app and set `COOKIE_SECURE=true` (and a suitable `COOKIE_SAME_SITE`) in `.env` so browsers send the cookie on TLS. Rebuild or recreate containers after changing env: `docker compose up --build -d`.

**Turning it off:** remove `DEMO_MODE` or set `DEMO_MODE=false` — the header shows identity and roles only; switching requires **Sign out** and password login again.

## Local development (without Docker for the app)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run PostgreSQL** (install locally, or use only the DB from Docker Compose — see below).

3. **Configure `.env`**

   ```bash
   cp .env.example .env
   ```

   Point `DATABASE_URL` at your Postgres instance (same user/db/password as in `.env.example`, or your own).

4. **Apply migrations**

   ```bash
   npx prisma migrate deploy
   ```

   For iterative schema work you can use `npm run db:migrate` (`prisma migrate dev`) instead.

5. **Seed demo data**

   ```bash
   npm run db:seed
   ```

6. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open the **Local** URL printed in the terminal (often [http://localhost:3000](http://localhost:3000); the port may change if 3000 is busy). The dev script uses **`--hostname localhost`** so the server matches normal `http://localhost:…` requests. If you see **Home** with the sidebar but no **Demo sign-in** card, you still have a session cookie—try a private window or clear cookies for this site. A blank or refused page on port 3000 often means another process is using that port; use the URL and port from the terminal.

   **Stuck / “Another next dev server is already running”:** stop every listener on the dev ports, remove the stale lock, then start once:

   ```bash
   for port in 3000 3001; do pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN); [ -n "$pids" ] && kill $pids; done
   rm -f .next/dev/lock
   npm run dev
   ```

   Or use **`npm run dev:clean`** (clears `.next/dev/lock` only — still kill stray `node` processes on 3000/3001 if ports stay busy).

## Docker Compose (app + Postgres)

Use this for an **EC2 internal pilot** or any host with Docker and Docker Compose: one container runs **Next.js** in production mode, another runs **PostgreSQL 16**. Postgres data persists in a **named volume**. For **local development**, Postgres is also mapped **`5432:5432`** so tools on the host (Prisma CLI, `npm run dev`) can use `DATABASE_URL` with **`localhost:5432`**. The **app** container still uses the internal hostname **`postgres`** on the Compose network.

### Prerequisites

- Docker and Docker Compose v2
- A root `.env` file (optional but recommended) with at least `SESSION_SECRET` set for non-throwaway pilots

### Commands (local laptop or EC2)

From the repository root:

```bash
cp .env.example .env
# Edit .env: set SESSION_SECRET (and anything else you need).

docker compose up --build
```

- **App:** [http://localhost:3000](http://localhost:3000) (host port **3000** → container **3000**).
- On first start the **app** entrypoint runs **`npx prisma migrate deploy`**, then **`npm run start`** (production Next.js).

### Initialize the database (Compose)

Migrations run automatically when the app container starts. To load demo users and cases **once** (or after you reset the volume):

```bash
docker compose exec app npx prisma db seed
```

(`package.json` maps this to `tsx prisma/seed.ts`.)

### Reset Postgres data (Compose, destructive)

Removes the named volume and recreates an empty database on next `up`:

```bash
docker compose down -v
docker compose up --build
docker compose exec app npx prisma db seed
```

### Run only Postgres locally (app still via `npm run dev`)

If you want PostgreSQL in Docker but the Next app on the host:

```bash
docker compose up postgres -d
```

Use `DATABASE_URL="postgresql://eox:eox@localhost:5432/eox_workflow?schema=public"` in `.env`, then `npx prisma migrate deploy` and `npm run db:seed` on the host.

### EC2 (internal pilot)

On the instance (Docker + Git already installed; Node not required on the host if you run only Compose):

```bash
git clone <YOUR_REPO_URL> eox-workflow-demo
cd eox-workflow-demo
cp .env.example .env
# Set SESSION_SECRET to a strong value (minimum 32 characters — required for sign-in to work).
# Optional: DEMO_MODE=true for header persona switching during demos (pilot only).
nano .env   # or vi

docker compose up --build -d
docker compose exec app npx prisma db seed
```

Open **`http://<EC2_PUBLIC_IP>:3000`** in a browser (ensure the security group allows **TCP 3000** inbound, or put a reverse proxy in front and map ports accordingly). Demo login: see **Demo Login Credentials** below (`Demo123!`).

## Useful Commands

```bash
npm run build        # prisma generate + next build
npm run start        # production server (after build)
npm run lint         # static lint checks
npm run db:generate  # regenerate Prisma client
npm run db:studio    # Prisma Studio
npm run db:reset     # destructive: wipe DB, migrate, seed (local demo reset — see docs/HANDOFF_CURRENT_STATE.md)
```

## Demo Login Credentials

All seeded users use password:

```text
Demo123!
```

Enter that password on the **Demo sign-in** form (user dropdown + password field).

Users (10 total, same password **Demo123!**; **8** have seeded workload, **2** have **no** cases or tasks — empty queues for CX `cx.inactive@local` and Account `account.inactive@local`; all remain `isActive` for sign-in):

- **CX (4):** `cx.primary@local` (also Account + Platform admin), `cx.priya@local`, `cx.luis@local`, `cx.inactive@local` *(empty portfolio)*
- **General (6):** `sales.demo@local`, `account.maya@local`, `bu.demo@local`, `finance.demo@local`, `leader.demo@local`, `account.inactive@local` *(empty portfolio)*

## High-Level Architecture

- **App shell**: role-aware navigation, demo banner/footer, session identity context.
- **Auth**: local email/password with HttpOnly session token.
- **RBAC/assignment model**:
  - role checks (CX/BU/Finance/Leadership/Admin/Account)
  - assignment checks (case owner, case team queue, task team queue, and **direct task assignees** via `TaskAssignee` plus legacy `Task.ownerId`)
  - unowned team tasks are actionable by authorized team members when **no** individual assignees are set.
- **Data model**:
  - `Case` can be assigned to a queue/team and optionally an owner
  - `Task` can be assigned to a queue/team; **multiple users** share one task row via `TaskAssignee` (first assignee is mirrored on `Task.ownerId` for compatibility)
  - `ExternalReference`, `Comment`, `Attachment`, `ActivityLog` linked to case/task context
- **Reports**: filtered datasets from role-scoped visible cases.

## Role Model Summary

- **Account Team**
  - own requests/cases only
  - can create requests
  - no reports dashboard
- **CX Ops**
  - full operational queues and reports
  - can manage case/task assignment and status transitions
- **BU Contributor / Finance Approver**
  - assigned case/task scopes
  - can act on assigned tasks, including unowned team-queue tasks
  - scoped reports access
- **Leadership**
  - full read-only visibility for cases and reports
- **Platform Admin**
  - full access across app

## Known Limitations

- Local auth only (no enterprise SSO/IdP integration)
- Attachment handling is metadata/demo-path based (no binary storage pipeline)
- No dedicated admin console for role/team management yet
- No audit export package; activity log is in-app
- No automated end-to-end test suite yet
- Docker image copies full `node_modules` from the build stage for simplicity (internal pilot). The runtime image also includes **`src/`** and **`tsconfig.json`** so **`docker compose exec app npx prisma db seed`** can resolve `prisma/seed.ts` imports from the repo (e.g. `src/lib/workflow/task-templates.ts`). Tighten for supply-chain/size if this graduates beyond a pilot

## Production Direction

This section describes the intended production evolution and is **separate** from the current local demo implementation.

- Authentication would move to corporate SSO.
- Authorization would use group-based entitlements plus assignment-based access.
- Local passwords would be removed.
- Users, roles, and teams would be synced from enterprise identity sources.
- Queue-based routing would support joiner/mover/leaver scenarios.
- External systems would remain authoritative unless future integrations are approved.

## Suggested Leadership Demo Flow

1) Sign in as `leader.demo@local` and open **Reports**:
   - KPI cards
   - status/type/aging/monthly trend charts
   - bottlenecks + recent blocked tables
2) Switch to `cx.primary@local`:
   - open **Cases** queue
   - filter by status/team
   - open a blocked case
3) In case workspace:
   - show team/owner fallback behavior
   - update a task, add reference/comment, and review activity log
   - demonstrate status guardrails (reason-required and completion-gated transitions)
4) Open **New Request**:
   - save draft
   - submit and show queue routing into operations.

## Migrations note (SQLite → PostgreSQL)

Historical **SQLite-only** migration SQL was replaced by a **single PostgreSQL baseline** (`prisma/migrations/20260530120000_init_postgresql`) aligned with the current `schema.prisma`. Fresh Postgres databases should use `prisma migrate deploy` (or `migrate dev` during development). Do **not** point `migrate reset` at shared production databases.
