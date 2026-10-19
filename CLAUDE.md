\# CODING STANDARDS

\- TypeScript `strict: true`, no `any` (use `unknown` + narrowing).

\- Functions do one thing (\~30 lines), early returns, no deep nesting.

\- Domain functions are pure and take `now` as a parameter; never call `new Date()` inside them.

\- Typed errors with stable codes (`BOOKING\_DEADLINE\_PASSED`, `SLOT\_UNAVAILABLE`, `LEAVE\_RANGE\_INVALID`, `PERMISSION\_DENIED`, `OVERRIDE\_REASON\_REQUIRED`, `ROSTER\_IMPORT\_INVALID`); a global filter maps them to the standard shape.

\- Validate at every boundary; share Zod schemas via `@ennel/shared`.

\- No business logic in controllers or components; no Prisma outside repositories.

\- DB transactions for multi-write use cases; every admin mutation writes its audit entry inside that transaction.

\- Structured logging with request ID; never log secrets or personal data.

\- Comments explain why, not what; public domain functions cite the spec or requirement section.

\- Secrets only in `.env`; commit `.env.example` only.

\- Student app follows spec sections 14 and 17 (loading states, duplicate-submit prevention, confirmations, text+colour statuses, AM/PM, palette Deep Green #0B5D46 / Soft Mint #E7F4EC, Inter font). The admin app reuses the same palette and tokens from a shared theme.

\# WORKING RULES FOR YOU (Claude Code)

1\. Plan before coding: write a short plan per phase (files, tables, endpoints, permissions, tests). In Phase 0 wait for my confirmation; in later phases state the plan and proceed.

2\. Do not invent business rules. If the spec or admin requirements are ambiguous, implement a configurable policy with a safe default and record an ADR in `docs/decisions/`.

3\. Small, reviewable commits following Conventional Commits.

4\. No libraries beyond the stack without asking and justifying.

5\. Keep `docs/business-rules.md`, `docs/api-contract.md`, `docs/rbac-matrix.md` and `docs/architecture.md` current.

6\. No deployment work.

7\. Every admin mutation requires a permission check, an audit entry, and (for overrides) a mandatory reason.

8\. If something needs my input (policy decisions, college data, API access, confirmation of admin assumptions), list it clearly instead of guessing.

\# ADMIN DASHBOARD: FEATURES AND RULES

\## A. Roles and permissions (RBAC)

Default roles (editable only by Super Admin):

\- `SUPER\_ADMIN`: everything, including staff, roles, policy.

\- `MESS\_MANAGER`: config, menus, closures, bookings, attendance, no-shows, leaves, announcements, forecasting, reports, complaints.

\- `MESS\_STAFF` (counter/kitchen): view live attendance, mark manual attendance, view forecasting and today's counts only.

\- `WARDEN`: view students, approve leaves, view/resolve complaints, view reports.

\- `AUDITOR`: read-only access to reports and the audit log.

Permissions are `resource:action` keys defined once in `@ennel/shared`; the backend enforces them via `@RequirePermissions(...)` and the admin UI hides/disables controls with `<PermissionGate>`. The UI is a convenience only, the API is the authority. Document the matrix in `docs/rbac-matrix.md`.

\## B. Staff authentication and security

Separate `staff\_users` table and login endpoint; password policy; account lockout after repeated failures; forced password change on first login; refresh-token rotation; optional TOTP 2FA (implement the structure, enable per staff); session list and "log out everywhere". The first Super Admin is created via a seed script, never via a public endpoint.

\## C. Dashboard (home)

Today and selected-date overview: meals with booked / expected / attended counts; per-slot occupancy bars with availability labels; veg vs non-veg split; over-capacity flags; pending-work cards (leave approvals, open complaints, no-show appeals, unresolved attendance issues); 7-day booking trend and no-show rate charts; quick actions (publish menu, send announcement, open attendance counter).

\## D. Mess configuration

Manage meals, serving windows, slots (add/edit/disable), capacities (weekday defaults + per-date overrides), and availability thresholds. Validations: cannot delete a slot that has future bookings (offer disable + reassign flow); lowering capacity below current bookings shows a warning with impact counts; every change is audited. Policy settings page edits the `mess\_policy` flags (rule 8) with explanations and a change history.

\## E. Menu management

Per date and meal menu with items tagged Veg/Non-Veg, copy-from-previous-week, bulk weekly editor, draft/published states. Publishing a changed menu for a date with existing bookings triggers a "menu changed" notification to affected students.

\## F. Closures, holidays and special meals

Create a closure for a date/meal(s) (mess closed, festival, maintenance). Applying a closure runs a use case that marks affected bookings `CANCELLED\_BY\_CLOSURE`, notifies students, and ensures no No-shows are recorded. Support special-meal days with temporary menu and capacity overrides. Deleting a closure restores eligibility according to the resolution order (document behaviour).

\## G. Student and roster management

CSV/XLSX roster import with a validate-first preview (row-level errors, duplicates, existing records) and a confirm step; import jobs tracked in `import\_jobs`. Student list with search and filters (hostel, year, department, registered/unregistered, locked, default-booking state); student detail page showing profile, preferences, bookings, leaves, no-show counts, complaints count. Actions (with permission and reason, all audited): edit college-controlled fields, lock/unlock account, reset registration or password (generates a reset flow, never reveals a password), deactivate/reactivate, bulk update hostel.

\## H. Bookings management

Searchable, filterable booking grid (date, meal, slot, status, source, hostel). Admin actions: create a booking on behalf of a student, cancel, move to another slot, mark status corrections. Overrides may bypass student deadlines but require a mandatory `reason`, store `actor`, and are flagged in the audit log and visible on the student's booking detail ("Updated by mess staff"). Bulk actions with a preview of affected records.

\## I. Attendance and live counter

A counter-friendly view for the active meal window: scan/search by reference number, mark present, and see live attended vs booked counts per slot. Includes \*\*outage mode\*\* (toggle): when the face-verification system is down, attendance is recorded manually with source `MANUAL\_FALLBACK` and no-shows for that window can be held for review instead of auto-applied. Attendance records keep `source` (`FACE\_VERIFICATION`, `MANUAL\_FALLBACK`, `IMPORT`) and are never fabricated. Support CSV import of attendance for a window.

\## J. No-show management and appeals

List of no-show events with filters. Students can report an incorrect record (student-side feature); staff review the appeal queue: approve (event removed from rolling count and Default Booking re-enabled if the disable was caused by it) or reject with a reason; the student is notified either way. Manual actions: reset a student's no-show count for a meal, re-enable Default Booking, with a mandatory reason.

\## K. Leave management

List of all leaves with filters. When `leaveRequiresApproval` is on, an approval queue with approve/reject (reason on reject). Staff can also create, end or correct a leave on behalf of a student (audited). Approval triggers booking pausing and student notification.

\## L. Complaints and feedback management

Inbox with filters (type, category, meal, date, status, hostel), statuses `NEW → IN\_REVIEW → RESOLVED | REJECTED`, assignment to a staff member, internal notes (never visible to students), a student-visible response, photo viewing via signed URLs, and a category/meal quality analytics view. Respect `complaintPrivacyMode`: in anonymous mode, identity fields are not returned. Status changes notify the student.

\## M. Announcements

Compose with title, body, category, audience (all / hostel / block / academic year / custom list), optional schedule, and channels (in-app + push). Draft → scheduled → sent states, delivery counts, edit before send, and a history list. Scheduled sends run through BullMQ.

\## N. Kitchen demand forecasting

For a chosen date range: expected plates per meal, per slot, per Veg/Non-Veg, computed as booked count x historical show-up rate (rolling average per meal, with configurable lookback, default 14 days) with a clear confidence note when history is short. A printable/exportable kitchen sheet (PDF/XLSX). The formula lives in a pure domain function with unit tests; no ML required for the MVP.

\## O. Reports and analytics

Daily / weekly / monthly reports: bookings vs attendance, no-show rate by meal/hostel, slot utilization and over-capacity incidents, estimated food waste (booked-and-prepared minus attended), cancellation patterns and lead times, leave volume, complaint categories and resolution time. Filters by date range, meal, hostel. Export to CSV, XLSX and PDF via `ReportExporter`. Heavy queries use indexed aggregates, pagination or background generation for large ranges.

\## P. Audit log

Immutable `audit\_logs` (actor, role, action, entity type/id, before/after snapshot, reason, IP, user agent, request ID, timestamp). Every admin write use case writes its audit entry in the same transaction as the change. Viewer with filters by actor, entity, action and date; export for `AUDITOR`/`SUPER\_ADMIN`. No update/delete endpoint exists for audit logs.

\## Q. System health

Page showing background job status (last run, next run, failures with retry action), attendance provider status and outage-mode toggle, queue depth, and app version/config summary.

\## Admin UX standards

Consistent `DataTable` (server-side pagination, sorting, filters, column visibility, CSV export); confirmation dialogs for destructive actions; reason fields for overrides; optimistic locking or version checks on edited records to avoid overwriting a colleague's change; loading, empty and error states everywhere; keyboard-accessible, responsive down to tablet width; text labels with colour for statuses; IST times with AM/PM; breadcrumbs and a permission-aware sidebar.

# PROJECT MAP (added in Phase 0)

- Specs and rules: `docs/ennel-spec.md` (student spec, cite as "Spec §n"), `docs/admin-requirements.md` ("Admin §X"), `docs/business-rules.md` (`BR-…` IDs), `docs/rbac-matrix.md`, `docs/api-contract.md`, ADRs in `docs/decisions/`.
- Packages: `apps/api` (NestJS 11, Prisma 7 with `@prisma/adapter-pg`, client generated to `src/generated/prisma`), `apps/admin` (Vite + React 19 + Tailwind 4 + shadcn/ui), `apps/mobile` (Expo SDK 58 + Expo Router, routes in `app/`, features in `src/features/`), `packages/shared` (ESM, built to `dist/`; run `pnpm build:shared` or `pnpm dev:shared` before the apps).
- Tests: Vitest in shared/api/admin (API uses `unplugin-swc` for decorator metadata), Jest via `jest-expo` in mobile. Test files are `*.spec.ts(x)`.
- Lint enforces two rules from above: no Prisma imports outside `repositories/` and `infrastructure/database/`, and no `new Date()` / `Date.now()` in `domain/` folders or `packages/shared`.
- `audit_logs` is append-only via a DB trigger; never write a migration that drops it.
- Commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev:api|dev:admin|dev:mobile`.
