# ENNEL Admin Dashboard Requirements

The student spec (`docs/ennel-spec.md`) excludes the admin dashboard. The requirements below come from the project brief. They are **assumptions to be confirmed with mess management**. Each section has a confirmation status, and code comments cite them as "Admin §X".

| Status    | Meaning                                              |
| --------- | ---------------------------------------------------- |
| ASSUMED   | From the brief; not yet confirmed by mess management |
| CONFIRMED | Confirmed by mess management (record who and when)   |
| CHANGED   | Confirmed with changes (see the note)                |

## A. Roles and permissions (RBAC): ASSUMED

Default roles: `SUPER_ADMIN`, `MESS_MANAGER`, `MESS_STAFF`, `WARDEN`, `AUDITOR`. Only a Super Admin can edit them. Permission keys are `resource:action` strings defined once in `@ennel/shared`. The API enforces them with `@RequirePermissions`; the UI only hides or disables controls with `<PermissionGate>`. Full matrix: `docs/rbac-matrix.md`.

_Phase 2: implemented (API guards, roles page, PermissionGate, permission-aware sidebar)._

## B. Staff authentication and security: ASSUMED

Separate `staff_users` table and login endpoint. Password policy (BR-AUTH-3), lockout after repeated failures, forced password change on first login, refresh-token rotation, optional per-staff TOTP 2FA, session list, "log out everywhere". The first Super Admin is created by a seed script only, never through a public endpoint.

_Phase 2: implemented. Refresh token is an httpOnly cookie; TOTP is RFC 6238 with encrypted secrets._

## C. Dashboard (home): ASSUMED

Overview for today or a selected date: booked / expected / attended per meal; per-slot occupancy bars with availability labels; Veg vs Non-Veg split; over-capacity flags; pending-work cards (leave approvals, open complaints, no-show appeals, unresolved attendance issues); 7-day booking trend and no-show rate charts; quick actions (publish menu, send announcement, open attendance counter). `MESS_STAFF` sees today only.

## D. Mess configuration: ASSUMED

Manage meals, serving windows, slots (add/edit/disable), capacities (weekday defaults + per-date overrides) and availability thresholds. A slot with future bookings cannot be deleted; staff are offered a disable + reassign flow instead. Lowering capacity below current bookings shows a warning with impact counts. Every change is audited. The policy settings page edits `mess_policy` with explanations and change history.

_Phase 2: implemented (meals, windows, slots, capacities, thresholds, hostels, policy). Rules: BR-MEAL-4 to BR-MEAL-6._

## E. Menu management: ASSUMED

Menu per date and meal, with items tagged Veg/Non-Veg; copy from the previous week; bulk weekly editor; draft/published states. Publishing a _changed_ menu for a date that has bookings sends a "menu changed" notification to affected students.

_Phase 2: implemented. Notifications are in-app for now (BR-MENU-3); push arrives with the notifications phase._

## F. Closures, holidays and special meals: ASSUMED

Closures for a date and one or more meals (mess closed, festival, maintenance). Applying one cancels affected bookings as `CANCELLED_BY_CLOSURE`, notifies students and prevents No-shows. Special-meal days use a temporary menu (`is_special`) and per-date capacity overrides. Removing a closure restores eligibility through the resolver (BR-CLOS-2).

## G. Student and roster management: ASSUMED

CSV/XLSX roster import with a validate-first preview (row errors, in-file duplicates, existing records) and a confirm step, tracked in `import_jobs`. Student list with search and filters (hostel, year, department, registered/unregistered, locked, default-booking state). Student detail page: profile, preferences, bookings, leaves, no-show counts, complaints count. Actions, each with permission, reason and audit: edit college-controlled fields, lock/unlock, reset registration or password (one-time code flow, never reveals a password), deactivate/reactivate, bulk update hostel.

_Phase 2: implemented except the bookings, leaves and complaints panels on the student detail page, which fill in as those phases land. Rules: BR-ROS._

## H. Bookings management: ASSUMED

Booking grid filterable by date, meal, slot, status, source and hostel. Actions: create on behalf, cancel, move slot, status correction. Overrides may bypass deadlines, but they need a mandatory reason, store the actor, are flagged in the audit log, and show "Updated by mess staff" to the student. Bulk actions show a preview of the affected records first.

## I. Attendance and live counter: ASSUMED

Counter view for the active meal window: search or scan a reference number, mark present, see live attended vs booked per slot. **Outage mode** toggle: attendance is recorded manually as `MANUAL_FALLBACK`, and No-shows for that window are held for review. Records keep their `source` and are never fabricated. CSV import of attendance for a window.

## J. No-show management and appeals: ASSUMED

No-show list with filters. Appeal queue: approve (event excluded from the count; Default Booking re-enabled if this event caused the disable) or reject with a reason. The student is notified either way. Manual actions with a mandatory reason: reset a count for a meal, re-enable Default Booking.

## K. Leave management: ASSUMED

List of all leaves with filters. When `leaveRequiresApproval` is on, an approval queue with approve/reject (reason required on reject). Staff can create, end or correct a leave on a student's behalf (audited). Approval pauses bookings and notifies the student.

## L. Complaints and feedback: ASSUMED

Inbox filterable by type, category, meal, date, status and hostel. Status flow `NEW → IN_REVIEW → RESOLVED | REJECTED`; assignment to staff; internal notes; a student-visible response; photos through signed URLs; category/meal quality analytics. In `ANONYMOUS` mode no identity fields are returned or stored. Status changes notify identified students.

## M. Announcements: ASSUMED

Compose title, body, category, audience (all / hostel / block / academic year / custom list), optional schedule, channels (in-app + push). States draft → scheduled → sent; editable until sent; delivery counts; history. Scheduled sends run through BullMQ.

## N. Kitchen demand forecasting: ASSUMED

For a date range: expected plates per meal, slot and Veg/Non-Veg, computed as booked × historical show-up rate (BR-FC-1), with a confidence note when history is short. Printable/exportable kitchen sheet (PDF/XLSX). Pure domain function with unit tests; no ML.

## O. Reports and analytics: ASSUMED

Daily/weekly/monthly: bookings vs attendance, no-show rate by meal/hostel, slot utilization and over-capacity incidents, estimated food waste (booked-and-prepared minus attended), cancellation patterns and lead times, leave volume, complaint categories and resolution time. Filters: date range, meal, hostel. Export to CSV/XLSX/PDF. Large ranges run as background jobs.

## P. Audit log: ASSUMED

Immutable `audit_logs`: actor, role, action, entity type/id, before/after, reason, IP, user agent, request ID, timestamp. Written in the same transaction as the change. Viewer with filters; export for `AUDITOR` and `SUPER_ADMIN`. No update or delete endpoint exists.

_Phase 2: implemented (append-only table, viewer with filters, CSV export)._

## Q. System health: ASSUMED

Background job status (last run, next run, failures with retry), attendance provider status and outage toggle, queue depth, app version and config summary.

## UX standards: ASSUMED

`DataTable` with server-side pagination, sorting, filters, column visibility and CSV export; confirmation dialogs for destructive actions; reason fields for overrides; version checks on edits; loading, empty and error states everywhere; keyboard-accessible; responsive to tablet width; statuses shown with text plus colour; IST times with AM/PM; breadcrumbs; permission-aware sidebar.

---

## Open items to confirm with mess management / college

Phase 0 ships the defaults below (approved by the project owner on 2026-10-19). Each one still needs institutional confirmation before launch.

| #   | Item                                                                           | Default in code                                                   | Ref          |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------ |
| 1   | Real meal timetable, breakfast window, slot capacities                         | Spec times; capacity 500 placeholder                              | Spec §18.1–2 |
| 2   | Over-capacity booking allowed?                                                 | No                                                                | ADR-0005     |
| 3   | Availability thresholds                                                        | Filling Fast ≥80%, Recommended ≤60% least-occupied                | ADR-0013     |
| 4   | Veg/Non-Veg change deadline                                                    | 60 min before slot start                                          | ADR-0012     |
| 5   | Default slot full: auto-fallback or ask                                        | Ask student                                                       | ADR-0006     |
| 6   | Leave requires approval?                                                       | No                                                                | ADR-0007     |
| 7   | No-show policy (30 days, warn 3, disable 5) and appeal process                 | As stated; re-enable per BR-NS-6                                  | ADR-0009     |
| 8   | Complaint privacy model                                                        | Private, identified to authorized staff                           | ADR-0008     |
| 9   | Date exception vs weekday rule priority                                        | Date exception wins                                               | ADR-0014     |
| 10  | Face-verification API access                                                   | Not available; mock provider                                      | —            |
| 11  | College-controlled profile fields                                              | Ref no., name, department, year                                   | ADR-0018     |
| 12  | Reference number format                                                        | Digits only, spaces stripped, no checksum                         | BR-AUTH-1    |
| 13  | Email/SMS for credential reset                                                 | Not available; staff-issued one-time code                         | ADR-0019     |
| 14  | Booking horizon                                                                | 7 days                                                            | ADR-0011     |
| 15  | Ending leave early: earliest resume point                                      | First meal still before its cancellation deadline                 | BR-LEAVE-7   |
| 16  | Overlapping leaves                                                             | Not allowed                                                       | BR-LEAVE-2   |
| 17  | Complaint photo limits                                                         | JPEG/PNG/HEIC/WebP, ≤5 MB, ≤3 photos                              | BR-CMP-3     |
| 18  | Overall Default Booking OFF: cancel already-generated future default bookings? | Yes, those still before their cancellation deadline               | BR-DEF-3     |
| 19  | Auto-fallback slot order (if enabled)                                          | Next later slot, then earlier                                     | BR-DEF-2     |
| 20  | Forecast with short history                                                    | Low-confidence flag below 7 days; rate 1.0 with no history        | BR-FC-1      |
| 21  | RBAC assumptions marked **?** in the matrix                                    | See `docs/rbac-matrix.md`                                         | Admin §A     |
| 22  | Required profile fields at first-time setup                                    | Hostel block, room, student phone, parent phone; email optional   | BR-ONB-2     |
| 23  | Phone number format                                                            | 7–15 digits, optional leading `+`                                 | BR-ONB-2     |
| 24  | Login rate limits per device/IP                                                | 10/min login and register, 20/min roster check                    | BR-AUTH-8    |
| 25  | Roster entries missing from a new import file                                  | Left unchanged (deactivate students explicitly)                   | BR-ROS-4     |
| 26  | Unknown hostel/block in a roster file                                          | Row error; hostels and blocks are created on the Hostels page     | BR-ROS-2     |
| 27  | Staff self-protection                                                          | No self-disable/self-demotion; at least one active Super Admin    | BR-STAFF-2   |
| 28  | Lowering slot capacity below existing bookings                                 | Allowed after an impact warning; no bookings cancelled            | BR-MEAL-6    |
| 29  | "Menu changed" notification                                                    | In-app only, to booked students, only when published items change | BR-MENU-3    |
| 30  | Who may manage hostels and blocks                                              | `mess-config:update` (Super Admin, Mess Manager)                  | rbac-matrix  |
