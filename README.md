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

Copy `.env.example` to `.env` and set values before running migrations or the app.

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
```

## Demo Login Credentials

All seeded users use password:

```text
Demo123!
```

Users:

- `sales.demo@local` (Account Team)
- `cx.demo@local` (CX Ops + Account Team)
- `bu.demo@local` (BU Contributor)
- `finance.demo@local` (Finance Approver)
- `leader.demo@local` (Leadership Read-only)
- `admin.demo@local` (Platform Admin)

## High-Level Architecture

- **App shell**: role-aware navigation, demo banner/footer, session identity context.
- **Auth**: local email/password with HttpOnly session token.
- **RBAC/assignment model**:
  - role checks (CX/BU/Finance/Leadership/Admin/Account)
  - assignment checks (case owner, case team queue, task owner, task team queue)
  - unowned team tasks are actionable by authorized team members.
- **Data model**:
  - `Case` can be assigned to a queue/team and optionally an owner
  - `Task` can be assigned to a queue/team and optionally an owner
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
2) Switch to `cx.demo@local`:
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
