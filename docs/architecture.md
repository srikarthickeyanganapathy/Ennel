# ENNEL Architecture

Status: Phase 0 (approved 2026-10-19). Keep this file current when a module, provider or cross-cutting mechanism changes.

## 1. System context

```
 Expo student app ──┐                        ┌── PostgreSQL 16 (system of record)
                    ├── NestJS API (one app) ─┤
 Vite admin web  ───┘   /api/v1/*            └── Redis 7 (BullMQ queues, rate-limit counters)
                        /api/v1/admin/*
                        BullMQ worker process (same codebase, `pnpm dev:worker`, entry `src/worker.ts`)
```

Out of scope: all deployment (images, pipelines, cloud). Local development uses `docker-compose.dev.yml` with only Postgres and Redis.

## 2. Monorepo

| Package                             | Purpose                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/api`                          | NestJS modular monolith: student API, admin API, background jobs                             |
| `apps/mobile`                       | Expo (managed) student app, Expo Router                                                      |
| `apps/admin`                        | React + Vite admin dashboard                                                                 |
| `packages/shared` (`@ennel/shared`) | Zod schemas, enums, permission keys + default role map, error codes, constants, theme tokens |

pnpm workspaces, Node 20+, TypeScript `strict: true` everywhere (`tsconfig.base.json`).

## 3. Backend

### 3.1 Two API surfaces

| Surface | Prefix          | Guard(s)                                 | JWT audience / secret                  |
| ------- | --------------- | ---------------------------------------- | -------------------------------------- |
| Student | `/api/v1`       | `StudentJwtAuthGuard`                    | `ennel-student` / `JWT_STUDENT_SECRET` |
| Staff   | `/api/v1/admin` | `StaffJwtAuthGuard` + `PermissionsGuard` | `ennel-staff` / `JWT_STAFF_SECRET`     |

Because secrets and audiences differ, a token of one kind fails verification on the other surface (ADR-0015). Admin controllers use `@AdminController(path)`, which applies both guards. Every route declares `@RequirePermissions(...)`, `@AuthenticatedStaffOnly()` or `@PublicAdminRoute()`; the permissions guard refuses a route with none of them (fail closed), and `admin-authorization.int.spec.ts` enumerates every admin route to check it.

### 3.2 Layers inside each module

| Layer          | Folder                              | May import                                                                             | Responsibility                                                                                          |
| -------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Presentation   | `controllers/`, `dto/`, `mappers/`  | Nest HTTP, shared Zod schemas, one application service                                 | Validate input, call one use case, map the response. No business logic.                                 |
| Application    | `services/` (one file per use case) | domain, repository interfaces, provider interfaces, `TransactionRunner`, `AuditWriter` | Orchestrate a use case, own the transaction, write the audit entry inside it.                           |
| Domain         | `domain/`                           | `@ennel/shared` types/enums, `date-fns`, `date-fns-tz`                                 | Pure business rules. `now` is a parameter. Cites spec/requirement sections.                             |
| Infrastructure | `repositories/`                     | Prisma                                                                                 | The only place Prisma is used. Interface + `Prisma*Repository`, accepts an optional transaction client. |

Dependencies point inward only. Admin modules reuse student domain functions (for example `admin-bookings` calls the same cancellation rule as `bookings`, passing `{ actor, override: true, reason }`). One module never imports another module's repository; it uses an exported application service or domain function.

### 3.3 Providers (`src/infrastructure/`)

| Interface                  | MVP implementation                                      | Notes                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Clock`                    | `SystemClock`; `FakeClock` for tests                    | The only source of "now" for services and jobs.                                                                                                                                                                                                                                                             |
| `AttendanceProvider`       | `UnconfiguredAttendanceProvider` (returns nothing)      | Pulled when a window closes (`modules/attendance/provider`). The real adapter needs the college's API. In development, `POST /api/v1/dev/attendance` pushes a simulated verification through `AttendanceRecorder`; tests use `FakeAttendanceProvider`. Never fabricates verification timestamps (ADR-0025). |
| `PushNotificationProvider` | Expo push                                               | In-app notification rows are always written; push is best-effort.                                                                                                                                                                                                                                           |
| `FileStorageProvider`      | Local disk under `STORAGE_DIR`                          | Signed, expiring URLs for complaint photos.                                                                                                                                                                                                                                                                 |
| `ReportExporter`           | CSV (`csv-stringify`), XLSX (`exceljs`), PDF (`pdfkit`) | Same row model for all three formats.                                                                                                                                                                                                                                                                       |

### 3.4 Cross-cutting mechanisms

- **Errors:** `AppError(code, message, details?)` with stable codes from `@ennel/shared`; a global filter returns `{ code, message, details?, requestId }`.
- **Request context:** middleware assigns a request ID; an `AsyncLocalStorage` context carries requestId, actor, roles, IP and user agent for logging and auditing.
- **Logging:** Nest `ConsoleLogger` in JSON mode, with a redaction helper (passwords, tokens, phone numbers, emails, reference numbers are never logged).
- **Transactions:** `TransactionRunner.run(tx => ...)` wraps Prisma interactive transactions; repositories take the `tx` client.
- **Audit:** `AuditWriter.write(tx, entry)` is the only writer of `audit_logs`. A database trigger rejects UPDATE, DELETE and TRUNCATE on that table for every role (migration `audit_log_immutable`), so immutability holds even if code tries to change a row.
- **Idempotency:** `Idempotency-Key` header on booking, cancellation, leave and complaint POSTs; `idempotency_keys` stores the response in the same transaction (ADR-0016).
- **Time:** business time Asia/Kolkata; instants stored UTC; business dates as `DATE`; slot times as minutes since IST midnight (ADR-0002).
- **Policy:** `mess_policy` singleton with `version`; services load it once per use case and pass it to domain functions (ADR-0005..0013).
- **CORS:** `isAllowedOrigin` (`src/config/cors.ts`) allows the admin origin (`ADMIN_WEB_ORIGIN`) and, only when `NODE_ENV=development`, any `localhost` origin for the student app's web preview. Phones are not browsers and are unaffected.
- **Rate limiting:** `@RateLimit({ name, limit, windowSeconds })` + `RateLimitGuard`, backed by a Redis fixed-window counter (`RedisRateLimiter`, fails open). Tests swap in `InMemoryRateLimiter`.
- **Files:** `FileStorageProvider` (local disk under `STORAGE_DIR`) stores uploads under server-generated keys. `FileUrlSigner` issues HMAC-signed URLs (`FILE_SIGNING_SECRET`, 15-minute expiry) served by `GET /api/v1/files/*`. Upload types are detected from content (`detectImageType`).
- **Student auth:** `StudentJwtAuthGuard` verifies student access tokens and sets `@CurrentStudent()`. Refresh tokens are random 256-bit values stored as SHA-256 hashes; rotation marks the old session replaced in the same transaction as the new one, so a concurrent reuse is detected.
- **Staff auth:** `StaffJwtAuthGuard` verifies staff access tokens (claims `sid` for the session and `pwc` for a pending password change) and sets `@CurrentStaff()`. `PermissionsGuard` resolves the staff member's permissions from the database per request (`StaffPermissionsService`, 30 s cache, cleared on role changes) so a disabled account or a removed role takes effect immediately. The staff refresh token lives in an httpOnly, SameSite=Strict cookie scoped to `/api/v1/admin/auth`; the admin app keeps the access token in memory only. TOTP secrets are sealed with AES-256-GCM (`SecretBox`, `TOTP_ENCRYPTION_KEY`).
- **Concurrency locks:** besides version checks, slot changes take a per-meal transaction lock (`lockMeal`), login and reset-code failures use conditional updates so parallel attempts all count, and capacity checks use the slot/date advisory lock (ADR-0004).
- **Optimistic locking:** versioned records (`staff_users`, `college_roster`, `meals`, `slots`, `mess_policy`, `menus`, students) are updated with `WHERE id = ? AND version = ?`; zero rows updated → `VERSION_CONFLICT`.
- **Audit snapshots:** `toAuditSnapshot` strips secrets (password and code hashes, TOTP secrets, token hashes) from before/after values before they reach `audit_logs`.
- **Cross-module calls:** modules expose application services (e.g. `ListMealsService`, `GetMessPolicyService`, `SaveMealPreferencesService`). A service that takes part in another module's transaction accepts the `TransactionClient` as a parameter.

### 3.5 Booking model (ADR-0003)

Student intent lives in three separate tables that never overwrite each other (Rule 5):
`meal_preferences` (Default Booking) · `weekday_rules` (Plan Ahead weekday) · `date_exceptions` (one-day changes, including "skip").
`bookings` holds one row per student/date/meal with the current resolved status, and `booking_events` holds its timeline. `resolveEffectiveBooking` applies the order **closure > approved leave > date exception > weekday rule > Default Booking** (Rule 4). Capacity is checked under `pg_advisory_xact_lock(slot, date)` (ADR-0004).

### 3.6 Modules

Student-facing: `auth`, `students`, `mess-config`, `slots` (live availability, Phase 3), `menus`, `bookings` (resolver, meal cards, book/change/cancel, Phase 4; `BookingReconciler`, `SeatAllocator` and the full-slot fallback, Phase 5), `idempotency` (ADR-0016), `forecasting` (show-up rate, BR-FC), `default-preferences` (Spec §8, Phase 5), `plan-ahead` (weekday rules, Spec §6.2, Phase 6), `attendance` (provider port, `AttendanceRecorder`, window closing, Phase 7), `no-shows` (Spec §10, Phase 9: `NoShowEngine`, the only code that turns Default Booking off or on because of No-shows; window closing and outage review call it), `leaves` (Spec §11, Phase 8: `LeaveCommandsService` shared with `admin-leaves`, `LeaveTimelineService` for the earliest start and current meal), `no-shows`, `complaints`, `notifications`, `jobs`. `bookings` also serves My Bookings (`BookingHistoryService`, Phase 7) and owns `BookingOutcomeService`, the only way attendance turns a booking Completed or No-show, `LeaveBookingSync` (pause and resume against approved leaves) and `BookingRestorer` (bring a closed or paused booking back, shared by closure removal and leave).
Staff-facing (under `modules/admin/`): `admin-auth`, `staff-users`, `rbac`, `audit-log`, `admin-dashboard`, `admin-mess-config`, `admin-menus`, `admin-closures`, `admin-students`, `admin-bookings`, `admin-attendance`, `admin-no-shows`, `admin-leaves`, `admin-complaints`, `admin-announcements`, `admin-forecasting`, `admin-reports`, `admin-system`.

Booking writes go through one service, `BookingCommandsService`, used by students (`StudentBookingsService`, wrapped in `IdempotencyService`) and staff (`AdminBookingOverridesService`, `BulkBookingsService`, wrapped in an audited transaction). It writes the date exception, the booking row and a booking event together (ADR-0003) and takes the slot/date advisory lock before counting seats (ADR-0004). `BookingDayService` builds the Home meal cards from `resolveEffectiveBooking` and `meal-card-rules`.

### 3.7 Background jobs (BullMQ, `modules/jobs`)

`generate-default-bookings` (built in Phase 5: 00:30 IST via `upsertJobScheduler`, plus a catch-up run when the worker starts; ADR-0023), `close-attendance-window` (built in Phase 7: every 5 minutes, once per `date:meal`, catching up on the last two days; ADR-0025), `evaluate-no-show-thresholds`, `send-deadline-reminders`, `send-scheduled-announcements`, `process-roster-import`, `generate-large-report`. Every run records a `job_runs` row keyed by `(job_name, run_key)` so re-runs are no-ops, and every job takes time from `Clock`.

## 4. Clients

### 4.1 Mobile (`apps/mobile`)

Expo Router routes in `app/` are thin and render screens from `src/features/<feature>/`. Route groups: `(auth)` (Screens 2–4 and Login), `(onboarding)` (Screens 5–8, needs a session), `(tabs)` (needs completed onboarding), `(student)` (signed-in screens outside the tab bar: Slot Selection, Change Slots, the Default Booking meal editor, and `plan-ahead/` with its date view, calendar and weekday rule editor). Home and the Plan Ahead date view share `features/home/components/DayMeals`, so a one-date change works the same from both. `apiRequest` adds the access token, refreshes once on 401 (single-flight, because refresh tokens are single-use) and maps errors to `ApiError`. Forms use React Hook Form with the shared Zod schemas. `useSubmitLock` blocks double submits synchronously. The onboarding draft lives in a Zustand store so Back/Edit never loses entries. Each feature has `components/ hooks/ api/ types/ utils/ constants/`. Server state uses TanStack Query; Zustand holds session and UI state only; tokens live in SecureStore. The client holds no business rules: the API returns deadlines (`cancellationDeadlineAt`, `changeSlotDeadlineAt`) plus `canCancel` / `canChangeSlot` and a `disabledReason`, and the app renders them.

### 4.2 Admin (`apps/admin`)

`src/app/` holds the router, providers, auth guard and layout shell. Each feature has `pages/XxxPage.tsx` and `api/ hooks/ components/ types/ utils/ constants/`. `shared/components/DataTable` wraps TanStack Table in server-side mode against the common list contract. `<PermissionGate>` reads the permissions from `GET /api/v1/admin/auth/me`. It only hides or disables controls; the API is the authority.

Phase 2 building blocks:

- `shared/api-client`: `apiRequest` keeps the access token in memory, refreshes once on 401 through the cookie (single-flight), maps errors to `ApiError`, and `downloadFile` handles CSV/XLSX downloads.
- `features/auth/auth-context`: `AuthProvider` restores the session on load via refresh, exposes `useAuth()` and `usePermissions()`. `app/route-guards` sends signed-out visitors to `/login`, staff with a pending password change to `/change-password`, and checks a page's permission (`RequirePermission`).
- `shared/components`: `DataTable` (server-side pagination and sorting, column visibility, row selection, formula-safe CSV export of the visible page), `ReasonDialog` (mandatory reason for audited actions), `StatusBadge` (text + colour), `QueryStates` (loading/empty/error), `PageHeader` (breadcrumbs). Forms use native controls styled with the shared tokens; dialogs and menus use Radix.
- `shared/lib/format`: every date and time is shown in IST with AM/PM.
- The sidebar (`nav-items.ts`) lists only pages that exist and that the staff member may open.

### 4.3 Theme

Palette (Deep Green `#0B5D46`, Soft Mint `#E7F4EC`, warning yellow, critical red), spacing and radii are tokens in `@ennel/shared` and feed both Tailwind configs (NativeWind on mobile, Tailwind + shadcn/ui on admin). Font: Inter.

## 5. Testing

Unit tests on domain functions (highest priority) · integration tests against a real test Postgres (including a last-seat concurrency test) · an authorization suite per admin endpoint (allowed role, forbidden role → `PERMISSION_DENIED`, student token rejected) · audit tests (exactly one record per mutation, rolled back with the change) · component tests · Playwright for admin login, roster import, closure creation and appeal approval. All time-dependent tests use `FakeClock`.

Phase 2 state: the authorization suite and audit tests run as API integration tests. Admin component tests cover sign-in (incl. TOTP and the forced password change), the shell, `DataTable`, `PermissionGate` and `ReasonDialog`. Playwright is not set up yet: adding it needs a new dev dependency and browser download, so it is deferred to a later phase with your approval (the admin flows were checked by hand in a browser against a separate preview database).
