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
- Prisma ORM + SQLite
- Tailwind CSS
- React Hook Form + Zod
- Recharts

## Setup

1) Install dependencies

```bash
npm install
```

2) Configure environment

```bash
cp .env.example .env
```

Set `SESSION_SECRET` to a 32+ character value.

3) Apply migrations

```bash
npm run db:migrate
```

4) Seed demo data

```bash
npm run db:seed
```

5) Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful Commands

```bash
npm run build        # production build
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
