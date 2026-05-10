## Project Name
EoX Workflow Management Platform
Project Type
Internal Cisco leadership demo prototype built locally on a laptop.
Purpose
This application is a local, non-production prototype to demonstrate how Cisco CX can digitize and streamline the handling of EoVSS, EoSM, and ESS/MSS requests.
The goal of the prototype is to show:
� digital intake instead of Excel/PDF + email
� centralized case management
� task-based workflow orchestration
� role-based and assignment-based visibility
	�	operational reporting and dashboards
This prototype is for demonstration only and is not production-ready.
Business Context
Today, EoVSS / EoSM / ESS/MSS requests are handled through a fragmented process involving:
� Excel/PDF intake forms
� email-based coordination
� manually created Webex spaces
� spreadsheet trackers
	�	disconnected systems such as CCW, VAP, and APAS/NPI
This leads to:
� long cycle times, often 3-4 weeks
� duplicate data entry
� limited case visibility
� manual follow-up burden
� weak auditability
	�	poor seller and stakeholder experience
The app should demonstrate a better future-state operating model.
Product Positioning
This application is a:
� case-management platform
� workflow-orchestration layer
	�	operational system of record for request lifecycle tracking
This application is NOT:
� a quote engine
� an approval engine
� an APAS/NPI execution tool
	�	a replacement for CCW, VAP, APAS, or Cisco SSO in this prototype
In Phase 1 / MVP, the platform tracks and governs work across systems but does not execute external systems.

Salesforce IB (Issue Backlog Case) � Phase 1

Salesforce **Issue Backlog** linkage is tracked like other external artifacts: **`ExternalReference`** rows + **`ActivityLog`**. **Create** and **retry** are server-only actions that call a **provider abstraction** (`getSalesforceIbProvider()`); outcomes are persisted from the provider response (no UI-only success path).

**Phase 1 scope**

� **`ExternalReferenceType.SALESFORCE_IB`** with integration fields (orchestration state, SF record Id, case number, URLs, last attempt/error, optional JSON metadata).
� Case Detail **Salesforce IB Case** card: eligibility from case data (submitted pipeline, Intake Validation completed, customer + justification + platform line present); **CX Operations** and **Platform Admin** may **Create** / **Retry**; others see status when they can view the case.
� Actions: **`salesforce_ib_create_attempt`**, **`salesforce_ib_created`**, **`salesforce_ib_create_failed`** in the activity log.
� **Mock provider** (default): deterministic SF-like Id/case number from public case id + optional stability seed; optional env-driven fail-first id list for retry walkthroughs (see **`README.md`**).
� Deterministic seed includes IB scenarios (Created, Ready, Failed+retry trail, and a case with **no** IB row for live Create). See **`prisma/seed.ts`** file header.

**Intentionally out of Phase 1**

� Live Salesforce REST/OAuth implementation, Composite API Case create, inbound webhooks, or polling Salesforce for status.
� Bidirectional sync or treating Salesforce as the workflow engine of record for EoX tasks.
� Changing orchestration fundamentals (case + task model, RBAC matrix, demo empty-portfolio personas).

**Future production adapter**

Implement **`SalesforceIbProvider.createIbCase`** in the **`salesforce`** provider module (`src/lib/integrations/salesforce-ib/`). Set **`SALESFORCE_IB_PROVIDER=salesforce`** and wire credentials per **`docs/HANDOFF_CURRENT_STATE.md`**. Eligibility, payload mapping (**`mapEoXCaseToSalesforceIbPayload`**), RBAC, Case Detail flow, and persistence shape stay the same; only the provider implementation changes.

**Environment variables (concise)**

Detailed definitions live in **`README.md`** (table) and **`docs/HANDOFF_CURRENT_STATE.md`** (operational handoff). Names used here: **`DEMO_MODE`** (persona switcher), **`COOKIE_SECURE`** / **`COOKIE_SAME_SITE`** (session cookies), **`SALESFORCE_IB_PROVIDER`** + **`SALESFORCE_IB_MOCK_STABILITY_SEED`**, **`SALESFORCE_IB_MOCK_FAIL_FIRST_ATTEMPT_IDS`**, **`SALESFORCE_IB_MOCK_INSTANCE_URL`**, and future **`SALESFORCE_INSTANCE_URL`**, **`SALESFORCE_CLIENT_ID`**, **`SALESFORCE_CLIENT_SECRET`**, **`SALESFORCE_USERNAME`**, **`SALESFORCE_PASSWORD`** for the real adapter.

Supported Request Types

Use these request type identifiers consistently: **EoVSS**, **EoSM**, and **ESS/MSS** in customer-facing copy. In Prisma and server code the third enum value is **`ESS_MSS`**; public case IDs use the token **`ESSMSS`** (no slash). Do not re-store legacy **`EoSS`** as a `RequestType` � existing DB rows are migrated to **`ESS_MSS`**.

**EoSM � End of Software Maintenance**

- **EoSM** means **End of Software Maintenance**. It marks the end of **regular software maintenance** and **routine bug fixes** for the product in scope (dates and scope follow official lifecycle policy).
- Do **not** use **Service Migration** (or similar) wording when defining or describing **EoSM**; that is a different concept and must not be conflated with this request type.
- **Security vulnerability fixes** may continue on a separate track according to **EoVS / EoVSS** policy and timelines; duration and eligibility are **product-dependent** and are not the same thing as routine software maintenance after the EoSM milestone.

**Partner name (`partnerName`)**

- **Optional for every request type** (EoVSS, EoSM, and ESS/MSS / **`ESS_MSS`**).
- Partner name **must not** block **request creation** (draft save or submit) or **case updates** (routing, tasks, booking, financials, or any other authorized case mutation in this codebase).

**Quantity (`CaseAsset.quantity`)**

- **Optional per platform / equipment line** (not case-wide). Same non-blocking rule as partner name for intake and case updates in this codebase.

Core Product Principles
1. One request = one case record
2. External dependencies are tracked as tasks
3. Access is role-based and assignment-based
4. Case detail is the primary operational workspace
5. Auditability is required for key changes
6. Keep MVP simple, clean, and leadership-demo ready
	7	Architecture should be future-friendly for production identity and access
MVP Scope
The prototype should include:
� local login
� role-aware UI
� team/queue-aware workflow behavior
� Home / My Work page
� Create Request page
� Case List / Queue page
� Case Detail page
� Reports Dashboard
� case + task model
� activity log
� notes/comments
� attachment metadata handling
� external reference tracking
� Salesforce IB linkage (structured reference + provider-backed create/retry; mock-first)
	�	seeded demo data
Out of Scope for Prototype
Do not build:
� Cisco SSO
� real enterprise authentication
� real CCW integration
� real VAP integration
� real APAS/NPI integration
� real Salesforce IB API integration (Phase 1 ships a typed scaffold only when **`SALESFORCE_IB_PROVIDER=salesforce`**)
� bidirectional Salesforce IB sync
� real email delivery
� production deployment hardening
� full admin console
	�	customer-facing portal
These may be referenced in the UI as future production direction only.
Target Users / Personas
	1	Account Team / Sales
� creates requests
� views own requests
� tracks status
	�	mostly read-only after submission unless more information is requested
	2	CX Operations
� primary workflow operator
� manages case lifecycle
� assigns work
� updates statuses
� tracks external dependencies
	�	can close, reject, or cancel cases
	3	BU Contributor / Engineering Contact
� views assigned work only
� updates BU Review or BU Pricing tasks
	�	limited edit scope
	4	Finance Approver
� views assigned approval-related work only
� updates approval-related tasks
	�	limited edit scope
	5	Leadership Readonly
� read-only access
	�	views dashboards and case summaries
	6	Platform Admin
� full visibility for demo/admin purposes
	�	can see all cases and dashboards
Access Model
This prototype should support:
� multiple roles per user
� multiple team memberships per user
� role-based access
� assignment-based access
	�	team/queue-based routing
Production direction:
� authentication would eventually move to Cisco SSO
� authorization would eventually come from enterprise groups plus assignment rules
	�	this prototype should be structured so that local login can later be replaced cleanly
Recommended Roles
Use these exact role keys:
� ACCOUNT_TEAM
� CX_OPS
� BU_CONTRIBUTOR
� FINANCE_APPROVER
� LEADERSHIP_READONLY
	�	PLATFORM_ADMIN
A user may have multiple roles.
Recommended Team / Queue Model
Use teams/queues as first-class entities.
Example demo teams:
� CX Ops Global
� BU Review Queue
� Finance Approvers
� Leadership
	�	Platform Admin
Cases and tasks may be assigned to:
� a specific user
� a team/queue
	�	both
If a task is assigned to a team and no individual owner is set, an authorized member of that team should still be able to act on it.
Case Status Model
Use these exact case statuses:
� Draft
� Submitted
� In Review
� Awaiting Info
� In Progress
� Blocked
� Ready for Release
� Closed
� Rejected
	�	Cancelled
Treat these as case-level lifecycle statuses.
Task Model
Tasks represent work happening inside or outside the platform.
Use these exact task types:
� Intake Validation
� BU Review
� BU Pricing
� Quote Tracking
� VAP Tracking
� Flag Removal Tracking
	�	Additional Info Request
Use these exact task statuses:
� Not Started
� In Progress
� Completed
� Blocked
	�	Not Required
Each task should support:
� type
� status
� owner
� assigned team
� required/not required flag
� due date
� notes
� blocker reason
� not required reason
	�	timestamps
Workflow Model
The app should use a case + task architecture.
Important:
� do not model the app as one rigid linear stage sequence
� case status reflects the overall state of the request
	�	tasks reflect internal or external dependencies
Examples:
� a case may be In Progress while BU Review is Completed and VAP Tracking is In Progress
� not every case requires every task
� some tasks may be marked Not Required with a reason
	�	a case should not move to Ready for Release or Closed unless all required tasks are completed or marked Not Required
Core Case Data Fields
At minimum, cases should support:
� caseId
� requestType
� customerName
� partnerName (optional for all request types; must not block create or update)
� dealId
� platform
� softwareVersion
� status
� priority
� requester
� owner
� assignedTeam
� extensionStartDate
� extensionEndDate
� businessJustification
� migrationPlan (optional; intake UI: Supporting details � not Service Migration)
� per-platform quantity on CaseAsset (optional; must not block create or update)
� notes
� createdAt
	�	updatedAt
Additional EoVSS-Oriented Demo Fields
Support these fields for realistic intake behavior where practical:
� serialNumbers
� supportCoverageIndicator
� hwLdosDate
	�	eolBulletinLink
These may be optional or dynamically shown depending on request type.
External Reference Tracking
The app should track external references as structured data, not just in notes.
Support reference types such as:
� Quote ID
� VAP ID
� APAS/NPI Reference
	�	Salesforce IB (`SALESFORCE_IB`) � orchestration lifecycle + SF identifiers when linked
Each reference may include:
� reference type
� reference ID
� external status
� notes
	�	related task
Core Screens
The MVP should include these screens:
	1	Login
	�	local demo login only
	2	Home / My Work
� personalized view
� summary cards
	�	recent or assigned work
	3	Create Request
� request type selector
� dynamic intake form
� save draft
	�	submit request
	4	Case List / Queue
� search
� filters
� status view
	�	owner and team visibility
	5	Case Detail
� summary
� metadata
� workflow/tasks
� external references (QUOTE/VAP/APAS; Salesforce IB has its own card + structured fields)
� comments
� activity log
	�	attachments
	6	Reports Dashboard
� active vs closed
� cycle time
� blocked cases
� cases by status
� cases by request type
	�	bottlenecks
Design Preferences
The UI should be:
� desktop-first
� clean
� professional
� simple
� enterprise-style
� easy to demo to leadership
	�	not overly flashy
Use:
� clear typography
� clean cards and tables
� consistent badges for status/priority/role
� simple charts
	�	strong spacing and alignment
Authentication for Prototype
This prototype must use local demo login only.
Use these demo users:
� sales.demo@local
� cx.primary@local
� bu.demo@local
� finance.demo@local
� leader.demo@local
	�	admin.demo@local
Use this demo password for all users:
	�	Demo123!
Passwords should still be stored hashed.
The UI should clearly display:
� Demo environment
	�	Local authentication only
Demo Seed Data Expectations
Seed realistic fake data:
� at least 12 cases
� mixed request types
� mixed priorities
� mixed statuses
� blocked cases
� in-review cases
� ready-for-release cases
� closed cases
� realistic customer names
� realistic task assignments
	�	realistic quote / VAP / APAS reference IDs
	� seeded Salesforce IB variants (Created, Ready, Failed+retry trail, one case without IB for live Create)
At least one user should have:
� multiple roles
	�	or multiple team memberships
Reporting Requirements
Dashboard should show:
� Total Active Cases
� Closed Cases
� Avg Cycle Time
	�	Blocked Cases
Charts should include:
� cases by request type
� cases by status
� aging by status
	�	monthly case volume
Also show:
� bottlenecks table
	�	recent blocked cases
Activity / Audit Expectations
The app should maintain visible activity history for key actions such as:
� case created
� status changed
� owner changed
� task created
� task updated
� task completed
� task blocked
� note/comment added
� external reference added or updated
� Salesforce IB create attempt / success / failure (provider-backed)
	�	attachment metadata added
Each activity item should include:
� timestamp
� user
� action
	�	details
Role-Based Behavior Expectations
Account Team:
� can create requests
� can view own requests
� read-only for most submitted cases
	�	can respond to returned-for-info cases if implemented
CX Ops:
� can see all in-scope cases
� can update case status
� can assign owners
� can create/update tasks
� can trigger Salesforce IB create/retry when eligibility rules pass (with Platform Admin)
	�	can close/reject/cancel cases
BU Contributor:
� can see assigned cases/tasks only
	�	can update assigned BU-related tasks
Finance Approver:
� can see assigned approval-related work
	�	can update assigned tasks only
Leadership Readonly:
� read-only dashboards
	�	read-only case summaries
Platform Admin:
	�	full demo visibility and access
Technical Direction
Preferred stack:
� Next.js
� TypeScript
� Tailwind CSS
� Prisma
� SQLite
� React Hook Form
� Zod
	�	Recharts
Architecture should remain simple and modular.
Build Priorities
1. Working local authentication
2. Prisma schema and seed data
3. App shell and navigation
4. Home / My Work
5. Case List / Queue
6. Create Request
7. Case Detail
8. Reports Dashboard
	9	Demo polish
Important Implementation Notes
� This is a prototype, not a production system
� Optimize for clarity and demo value over completeness
� Keep code strongly typed
� Keep components modular
� Avoid overengineering
� Avoid fake production security claims
	�	Preserve a path to future enterprise authentication and authorization
Naming Consistency Rules
Use these names consistently across code and UI:
� EoVSS
� EoSM (End of Software Maintenance; not Service Migration)
� ESS/MSS (Prisma: ESS_MSS; public case ID prefix: ESSMSS)
� CX Operations
� BU Contributor
� Finance Approver
� Leadership Readonly
	�	Platform Admin
Do not use:
� legacy **EoSS** enum or IDs in new code (use **`ESS_MSS`** / **`ESSMSS-�`**)
� inconsistent status names
	�	inconsistent role names
Goal of the Demo
The prototype should make it easy to demonstrate:
1. how requests are submitted digitally
2. how a case becomes the single operational record
3. how work is tracked through tasks instead of spreadsheets and email
4. how different users see different views based on role and assignment
	5	how leadership gets better visibility through dashboards
The prototype should feel credible, structured, and presentation-ready.

