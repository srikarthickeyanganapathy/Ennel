# ENNEL Architecture

Status: Phase 0 (approved 2026-10-19). Keep this file current when a module, provider or cross-cutting mechanism changes.

## 1. System context

```
 Expo student app ──┐                        ┌── PostgreSQL 16 (system of record)
                    ├── NestJS API (one app) ─┤
 Vite admin web  ───┘   /api/v1/*            └── Redis 7 (BullMQ queues, rate-limit counters)
                        /api/v1/admin/*
                        BullMQ worker process (same codebase, `pnpm --filter api worker`)
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

Because secrets and audiences differ, a token of one kind fails verification on the other surface (ADR-0015). Every admin route carries `@RequirePermissions(...)`; a test enumerates admin routes and fails if one lacks it.

### 3.2 Layers inside each module

| Layer          | Folder                              | May import                                                                             | Responsibility                                                                                          |
| -------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Presentation   | `controllers/`, `dto/`, `mappers/`  | Nest HTTP, shared Zod schemas, one application service                                 | Validate input, call one use case, map the response. No business logic.                                 |
| Application    | `services/` (one file per use case) | domain, repository interfaces, provider interfaces, `TransactionRunner`, `AuditWriter` | Orchestrate a use case, own the transaction, write the audit entry inside it.                           |
| Domain         | `domain/`                           | `@ennel/shared` types/enums, `date-fns`, `date-fns-tz`                                 | Pure business rules. `now` is a parameter. Cites spec/requirement sections.                             |
| Infrastructure | `repositories/`                     | Prisma                                                                                 | The only place Prisma is used. Interface + `Prisma*Repository`, accepts an optional transaction client. |

Dependencies point inward only. Admin modules reuse student domain functions (for example `admin-bookings` calls the same cancellation rule as `bookings`, passing `{ actor, override: true, reason }`). One module never imports another module's repository; it uses an exported application service or domain function.

### 3.3 Providers (`src/infrastructure/`)

| Interface                  | MVP implementation                                      | Notes                                                                                             |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Clock`                    | `SystemClock`; `FakeClock` for tests                    | The only source of "now" for services and jobs.                                                   |
| `AttendanceProvider`       | `MockAttendanceProvider`                                | Driven by a dev-only endpoint and admin manual marking. Never fabricates verification timestamps. |
| `PushNotificationProvider` | Expo push                                               | In-app notification rows are always written; push is best-effort.                                 |
| `FileStorageProvider`      | Local disk under `STORAGE_DIR`                          | Signed, expiring URLs for complaint photos.                                                       |
| `ReportExporter`           | CSV (`csv-stringify`), XLSX (`exceljs`), PDF (`pdfkit`) | Same row model for all three formats.                                                             |

### 3.4 Cross-cutting mechanisms

- **Errors:** `AppError(code, message, details?)` with stable codes from `@ennel/shared`; a global filter returns `{ code, message, details?, requestId }`.
- **Request context:** middleware assigns a request ID; an `AsyncLocalStorage` context carries requestId, actor, roles, IP and user agent for logging and auditing.
- **Logging:** Nest `ConsoleLogger` in JSON mode, with a redaction helper (passwords, tokens, phone numbers, emails, reference numbers are never logged).
- **Transactions:** `TransactionRunner.run(tx => ...)` wraps Prisma interactive transactions; repositories take the `tx` client.
- **Audit:** `AuditWriter.write(tx, entry)` is the only writer of `audit_logs`. A database trigger rejects UPDATE, DELETE and TRUNCATE on that table for every role (migration `audit_log_immutable`), so immutability holds even if code tries to change a row.
- **Idempotency:** `Idempotency-Key` header on booking, cancellation, leave and complaint POSTs; `idempotency_keys` stores the response in the same transaction (ADR-0016).
- **Time:** business time Asia/Kolkata; instants stored UTC; business dates as `DATE`; slot times as minutes since IST midnight (ADR-0002).
- **Policy:** `mess_policy` singleton with `version`; services load it once per use case and pass it to domain functions (ADR-0005..0013).

### 3.5 Booking model (ADR-0003)

Student intent lives in three separate tables that never overwrite each other (Rule 5):
`meal_preferences` (Default Booking) · `weekday_rules` (Plan Ahead weekday) · `date_exceptions` (one-day changes, including "skip").
`bookings` holds one row per student/date/meal with the current resolved status, and `booking_events` holds its timeline. `resolveEffectiveBooking` applies the order **closure > approved leave > date exception > weekday rule > Default Booking** (Rule 4). Capacity is checked under `pg_advisory_xact_lock(slot, date)` (ADR-0004).

### 3.6 Modules

Student-facing: `auth`, `students`, `mess-config`, `menus`, `bookings`, `default-preferences`, `plan-ahead`, `leaves`, `no-shows`, `attendance`, `complaints`, `notifications`, `jobs`.
Staff-facing (under `modules/admin/`): `admin-auth`, `staff-users`, `rbac`, `audit-log`, `admin-dashboard`, `admin-mess-config`, `admin-menus`, `admin-closures`, `admin-students`, `admin-bookings`, `admin-attendance`, `admin-no-shows`, `admin-leaves`, `admin-complaints`, `admin-announcements`, `admin-forecasting`, `admin-reports`, `admin-system`.

### 3.7 Background jobs (BullMQ, `modules/jobs`)

`generate-default-bookings` (nightly), `close-attendance-window` (per meal window), `evaluate-no-show-thresholds`, `send-deadline-reminders`, `send-scheduled-announcements`, `process-roster-import`, `generate-large-report`. Every run records a `job_runs` row keyed by `(job_name, run_key)` so re-runs are no-ops, and every job takes time from `Clock`.

## 4. Clients

### 4.1 Mobile (`apps/mobile`)

Expo Router routes in `app/` are thin and render screens from `src/features/<feature>/`. Each feature has `components/ hooks/ api/ types/ utils/ constants/`. Server state uses TanStack Query; Zustand holds session and UI state only; tokens live in SecureStore. The client holds no business rules: the API returns deadlines (`cancellationDeadlineAt`, `changeSlotDeadlineAt`) plus `canCancel` / `canChangeSlot` and a `disabledReason`, and the app renders them.

### 4.2 Admin (`apps/admin`)

`src/app/` holds the router, providers, auth guard and layout shell. Each feature has `pages/XxxPage.tsx` and `api/ hooks/ components/ types/ utils/ constants/`. `shared/components/DataTable` wraps TanStack Table in server-side mode against the common list contract. `<PermissionGate>` reads the permissions from `GET /api/v1/admin/auth/me`. It only hides or disables controls; the API is the authority.

### 4.3 Theme

Palette (Deep Green `#0B5D46`, Soft Mint `#E7F4EC`, warning yellow, critical red), spacing and radii are tokens in `@ennel/shared` and feed both Tailwind configs (NativeWind on mobile, Tailwind + shadcn/ui on admin). Font: Inter.

## 5. Testing

Unit tests on domain functions (highest priority) · integration tests against a real test Postgres (including a last-seat concurrency test) · an authorization suite per admin endpoint (allowed role, forbidden role → `PERMISSION_DENIED`, student token rejected) · audit tests (exactly one record per mutation, rolled back with the change) · component tests · Playwright for admin login, roster import, closure creation and appeal approval. All time-dependent tests use `FakeClock`.
