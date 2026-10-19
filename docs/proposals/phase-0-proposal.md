# ENNEL: Phase 0 Proposal (for approval)

Status: **APPROVED 2026-10-19 with all proposed defaults** (§5 answers = the defaults shown). The canonical rules now live in `docs/business-rules.md`, `docs/rbac-matrix.md` and `docs/decisions/`; this file is kept as the approval record.
Sources: `ENNEL_Full_Student_Side_Functional_Specification.docx` (student spec, "Spec §n" below) and the build prompt (admin requirements, "Admin §X", and core rules "Rule n").

---

## 1. Architecture summary

### 1.1 Runtime shape

```
 Expo student app ──┐                       ┌── PostgreSQL 16 (system of record)
                    ├── NestJS API (1 app) ─┤
 Vite admin web  ───┘   /api/v1/*           └── Redis 7 (BullMQ queues, rate-limit counters)
                        /api/v1/admin/*
                        + BullMQ workers (same codebase; run as a separate local process: `pnpm api:worker`)
```

- **One NestJS modular monolith** with two API surfaces:
  - Student: `/api/v1/...` → `StudentJwtAuthGuard` (audience `ennel-student`, secret `JWT_STUDENT_SECRET`).
  - Admin: `/api/v1/admin/...` → `StaffJwtAuthGuard` (audience `ennel-staff`, secret `JWT_STAFF_SECRET`) + `PermissionsGuard`.
  - Different secrets **and** audiences, so a token of one kind fails signature verification on the other surface (defence in depth, tested in the authorization suite).
- **Worker process**: same Nest app bootstrapped with `JobsModule` only (no HTTP). Keeps jobs off the request path and lets tests run jobs synchronously with a fake `Clock`.

### 1.2 Backend layers (per module, dependencies point inward)

| Layer                       | Allowed imports                                                                            | Notes                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `controllers/`              | Nest HTTP, DTOs, one application service                                                   | Zod-validated input → service call → response mapper.                                               |
| `services/` (use cases)     | domain, repository **interfaces**, provider interfaces, `TransactionRunner`, `AuditWriter` | One file per use case. Opens the transaction, writes the audit entry inside it.                     |
| `domain/`                   | Nothing framework-related; `@ennel/shared` enums/types and `date-fns(-tz)` only            | Pure functions, `now` passed in. Cites spec sections.                                               |
| `repositories/`             | Prisma (only here)                                                                         | Interface + `Prisma*Repository` implementation; accept an optional `tx` client.                     |
| `infrastructure/` providers | external libs                                                                              | `Clock`, `AttendanceProvider`, `PushNotificationProvider`, `FileStorageProvider`, `ReportExporter`. |

Admin modules **reuse student domain functions** (e.g. `admin-bookings` calls `bookings/domain/evaluate-cancellation.ts` with `{ actor: STAFF, override: true, reason }`). Cross-module access goes through an exported application service or domain function, never another module's repository.

### 1.3 Key design decisions (each gets an ADR)

1. **Business time = Asia/Kolkata.** Instants are `timestamptz` (UTC). Business dates (`meal_date`, leave dates, closure dates) are Postgres `DATE` meaning "IST calendar date". Slot times are stored as **minutes since IST midnight** (`start_minute`, `end_minute`) to avoid Prisma's awkward `Time` mapping. One helper converts (date, minute) → UTC instant. _(ADR-0002)_
2. **Intent vs. materialized state.** Student choices are stored as three separate intent sources (Rule 5): `meal_preferences` (Default Booking), `weekday_rules` (Plan Ahead weekday), `date_exceptions` (one-day changes from Home or Plan Ahead, including "skip this day"). `bookings` holds **one row per student/date/meal** with the resolved, current status; it is what capacity, attendance and no-show logic read. `resolveEffectiveBooking(closure, leave, dateException, weekdayRule, preference)` is the single pure resolver (Rule 4). A manual one-time booking writes a `date_exception` + booking with source `MANUAL`; it never touches `meal_preferences` (Spec §3 Screen 8). _(ADR-0003)_
3. **Capacity concurrency.** Inside the booking transaction: `pg_advisory_xact_lock(hash(slot_id, meal_date))` then `COUNT(*)` on an index of `(slot_id, meal_date, status)`. No separate counter table, so no drift to reconcile. Concurrency integration test for the last seat. _(ADR-0004)_
4. **Policy as data.** `mess_policy` is a single typed row with a `version` column (optimistic locking) and `mess_policy_history` storing before/after JSON per change. Domain functions receive a `MessPolicy` object; nothing reads policy globals. _(ADR-0005..0013)_
5. **Idempotency (Rule 13).** Clients send `Idempotency-Key` on booking/cancel/leave/complaint POSTs. `idempotency_keys` table (unique on actor+key) stores the response inside the same transaction; a replay returns the stored response. Mobile also disables buttons while pending (Spec §14). _(ADR-0016)_
6. **Audit (Admin §P).** `AuditWriter.write(tx, entry)` is the only way to write `audit_logs`; request context (actor, role, IP, UA, requestId) comes from an `AsyncLocalStorage` audit-context interceptor. DB role grants: the app's DB user has `INSERT, SELECT` only on `audit_logs` (enforced by a migration), so immutability holds even against bugs.
7. **Logging.** Nest's built-in `ConsoleLogger` in JSON mode (Nest 11) plus a request-ID middleware; a redaction helper strips passwords, tokens, phone numbers, emails. No extra logging library.
8. **Shared package `@ennel/shared`.** Enums, permission keys + default role map, Zod schemas (consumed by API DTOs, admin forms, mobile forms), pagination contract, error codes, **theme tokens** (palette, spacing, radii) consumed by both Tailwind configs.

### 1.4 Clients

- **Mobile (Expo Router):** routes in `app/` are thin and render `src/features/<feature>/screens/*`. Data via feature hooks on TanStack Query; Zustand only for session/UI state; tokens in SecureStore. No business rules client-side: countdowns render server-provided `cancellationDeadlineAt` / `changeSlotDeadlineAt` and `canCancel`/`canChangeSlot` + `disabledReason`.
- **Admin (Vite):** `app/` holds router, providers, auth guard and layout shell; each feature has `pages/XxxPage.tsx`, `api/`, `hooks/`, `components/`. `DataTable` wraps TanStack Table in server-side mode against the shared list contract. `<PermissionGate permission="bookings:override">` reads permissions returned by `GET /admin/auth/me`.

### 1.5 Domain vocabulary decision (needs your OK, see Q1)

The spec uses "meal type" for **Veg / Non-Veg**, while the prompt uses `MealType` for **Breakfast / Lunch / Dinner** (`getAttendance(studentId, mealDate, mealType)`). To avoid one word meaning two things in code:

- `MealType` = `BREAKFAST | LUNCH | DINNER`
- `DietType` = `VEG | NON_VEG` (UI copy still says "Meal type: Veg / Non-Veg", as in the spec)
- Policy flag `mealTypeChangeCutoffMinutes` → proposed rename `dietTypeChangeCutoffMinutes`.

---

## 2. Proposed Prisma schema (draft)

Conventions: models singular PascalCase, `@@map` plural snake_case, `@map` snake_case columns, UUID PKs, `created_at`/`updated_at` UTC. Soft delete (`deleted_at`) only on `meal_slots`, `menu_items`, `staff_users` (history matters); everything else uses status fields.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ───────────── Enums ─────────────
enum MealType            { BREAKFAST LUNCH DINNER }
enum DietType            { VEG NON_VEG }
enum BookingSource       { DEFAULT MANUAL PLAN_AHEAD_DATE PLAN_AHEAD_WEEKDAY ADMIN }
enum BookingStatus       { BOOKED CANCELLED COMPLETED NO_SHOW PAUSED_LEAVE CANCELLED_BY_CLOSURE }
enum DateExceptionAction { BOOK SKIP }                      // BOOK carries slot+diet; SKIP = "not this day"
enum StudentStatus       { ACTIVE LOCKED DEACTIVATED }
enum LeaveStatus         { PENDING APPROVED REJECTED CANCELLED }   // Upcoming/On Leave are derived from dates
enum NoShowStatus        { COUNTED HELD_FOR_REVIEW EXCLUDED }
enum NoShowExclusionCause{ APPEAL_APPROVED STAFF_RESET OUTAGE_REVIEW_DISMISSED }
enum AppealStatus        { PENDING APPROVED REJECTED }
enum AttendanceSource    { FACE_VERIFICATION MANUAL_FALLBACK IMPORT }
enum ComplaintType       { COMPLAINT FEEDBACK }
enum ComplaintCategory   { FOOD_QUALITY FOREIGN_OBJECT CLEANLINESS SERVICE MENU OTHER }
enum ComplaintStatus     { NEW IN_REVIEW RESOLVED REJECTED }
enum ComplaintPrivacyMode{ ANONYMOUS PRIVATE_IDENTIFIED }
enum SlotFullFallback    { AUTO_NEXT_AVAILABLE ASK_STUDENT }
enum MenuStatus          { DRAFT PUBLISHED }
enum ClosureKind         { MESS_CLOSED FESTIVAL MAINTENANCE }
enum ClosureStatus       { ACTIVE REMOVED }
enum AnnouncementStatus  { DRAFT SCHEDULED SENDING SENT CANCELLED }
enum AnnouncementAudience{ ALL HOSTEL BLOCK ACADEMIC_YEAR CUSTOM }
enum DeliveryStatus      { PENDING DELIVERED FAILED }
enum ImportJobType       { ROSTER ATTENDANCE }
enum ImportJobStatus     { UPLOADED VALIDATED CONFIRMED PROCESSING COMPLETED FAILED CANCELLED }
enum ImportRowOutcome    { VALID INVALID DUPLICATE_IN_FILE EXISTING_UNCHANGED EXISTING_UPDATE }
enum StaffStatus         { ACTIVE LOCKED DISABLED }
enum NotificationCategory{ ANNOUNCEMENT BOOKING REMINDER WARNING LEAVE COMPLAINT MENU NO_SHOW }
enum JobRunStatus        { RUNNING SUCCEEDED FAILED }

// ───────────── Roster, students, auth ─────────────
model Hostel {
  id        String        @id @default(uuid()) @db.Uuid
  name      String        @unique
  isActive  Boolean       @default(true) @map("is_active")
  blocks    HostelBlock[]
  @@map("hostels")
}
model HostelBlock {
  id       String  @id @default(uuid()) @db.Uuid
  hostelId String  @map("hostel_id") @db.Uuid
  name     String
  hostel   Hostel  @relation(fields: [hostelId], references: [id])
  @@unique([hostelId, name])
  @@map("hostel_blocks")
}

model CollegeRosterEntry {           // college-controlled source of truth (Rule 11)
  id               String   @id @default(uuid()) @db.Uuid
  referenceNumber  String   @unique @map("reference_number")   // normalized: digits only
  fullName         String   @map("full_name")
  department       String
  academicYear     Int      @map("academic_year")
  hostelBlockId    String?  @map("hostel_block_id") @db.Uuid
  roomNumber       String?  @map("room_number")
  email            String?
  isActive         Boolean  @default(true) @map("is_active")
  lastImportJobId  String?  @map("last_import_job_id") @db.Uuid
  student          Student?
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  @@index([hostelBlockId])
  @@map("college_roster")
}

model Student {                      // exists only once registered; unregistered = roster entry w/o student
  id                    String        @id @default(uuid()) @db.Uuid
  rosterEntryId         String        @unique @map("roster_entry_id") @db.Uuid
  passwordHash          String        @map("password_hash")
  status                StudentStatus @default(ACTIVE)
  // Profile (editable subset governed by policy.collegeControlledFields)
  fullName              String        @map("full_name")
  department            String
  academicYear          Int           @map("academic_year")
  hostelBlockId         String?       @map("hostel_block_id") @db.Uuid
  roomNumber            String?       @map("room_number")
  phone                 String?
  parentPhone           String?       @map("parent_phone")
  email                 String?
  photoKey              String?       @map("photo_key")
  onboardingCompletedAt DateTime?     @map("onboarding_completed_at")
  defaultBookingEnabled Boolean       @default(false) @map("default_booking_enabled") // overall switch, Spec §8.1
  failedLoginCount      Int           @default(0) @map("failed_login_count")
  lockedUntil           DateTime?     @map("locked_until")
  version               Int           @default(1)
  rosterEntry           CollegeRosterEntry @relation(fields: [rosterEntryId], references: [id])
  createdAt             DateTime      @default(now()) @map("created_at")
  updatedAt             DateTime      @updatedAt @map("updated_at")
  @@index([hostelBlockId, status])
  @@map("students")
}

model StudentSession {               // refresh-token rotation with family revocation
  id             String    @id @default(uuid()) @db.Uuid
  studentId      String    @map("student_id") @db.Uuid
  familyId       String    @map("family_id") @db.Uuid
  tokenHash      String    @unique @map("token_hash")
  replacedById   String?   @map("replaced_by_id") @db.Uuid
  userAgent      String?   @map("user_agent")
  ip             String?
  expiresAt      DateTime  @map("expires_at")
  revokedAt      DateTime? @map("revoked_at")
  lastUsedAt     DateTime? @map("last_used_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  @@index([studentId, revokedAt])
  @@map("student_sessions")
}

model CredentialResetTicket {        // Admin §G "reset registration or password": never reveals a password
  id           String    @id @default(uuid()) @db.Uuid
  studentId    String    @map("student_id") @db.Uuid
  kind         String                                  // PASSWORD | REGISTRATION
  codeHash     String    @map("code_hash")
  expiresAt    DateTime  @map("expires_at")
  usedAt       DateTime? @map("used_at")
  issuedById   String    @map("issued_by_id") @db.Uuid
  createdAt    DateTime  @default(now()) @map("created_at")
  @@index([studentId, usedAt])
  @@map("credential_reset_tickets")
}

model PushToken {
  id         String   @id @default(uuid()) @db.Uuid
  studentId  String   @map("student_id") @db.Uuid
  token      String   @unique
  platform   String
  createdAt  DateTime @default(now()) @map("created_at")
  @@map("push_tokens")
}

// ───────────── Mess configuration ─────────────
model Meal {
  id                    String   @id @default(uuid()) @db.Uuid
  mealType              MealType @unique @map("meal_type")
  displayName           String   @map("display_name")
  serviceStartMinute    Int      @map("service_start_minute")   // IST minutes since midnight
  serviceEndMinute      Int      @map("service_end_minute")
  attendanceGraceMinutes Int     @default(0) @map("attendance_grace_minutes") // window closes at end + grace
  isActive              Boolean  @default(true) @map("is_active")
  slots                 MealSlot[]
  updatedAt             DateTime @updatedAt @map("updated_at")
  version               Int      @default(1)
  @@map("meals")
}

model MealSlot {                     // Breakfast = one slot spanning its window (Rule 1)
  id               String    @id @default(uuid()) @db.Uuid
  mealId           String    @map("meal_id") @db.Uuid
  label            String
  startMinute      Int       @map("start_minute")
  endMinute        Int       @map("end_minute")
  sortOrder        Int       @map("sort_order")
  defaultCapacity  Int       @map("default_capacity")
  isActive         Boolean   @default(true) @map("is_active")
  deletedAt        DateTime? @map("deleted_at")
  version          Int       @default(1)
  meal             Meal      @relation(fields: [mealId], references: [id])
  weekdayCapacities SlotWeekdayCapacity[]
  overrides        SlotCapacityOverride[]
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")
  @@index([mealId, isActive, sortOrder])
  @@map("meal_slots")
}

model SlotWeekdayCapacity {
  slotId    String   @map("slot_id") @db.Uuid
  weekday   Int                                   // 0=Sun..6=Sat, IST
  capacity  Int
  slot      MealSlot @relation(fields: [slotId], references: [id])
  @@id([slotId, weekday])
  @@map("slot_weekday_capacities")
}

model SlotCapacityOverride {         // per-date override, incl. special-meal days (Admin §F)
  id        String   @id @default(uuid()) @db.Uuid
  slotId    String   @map("slot_id") @db.Uuid
  mealDate  DateTime @map("meal_date") @db.Date
  capacity  Int
  reason    String
  slot      MealSlot @relation(fields: [slotId], references: [id])
  createdById String @map("created_by_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  @@unique([slotId, mealDate])
  @@map("slot_capacity_overrides")
}

model MessPolicy {                   // singleton row id=1 (Rule 8)
  id                              Int              @id @default(1)
  allowOverCapacityBooking        Boolean          @default(false) @map("allow_over_capacity_booking")
  defaultSlotFullFallback         SlotFullFallback @default(ASK_STUDENT) @map("default_slot_full_fallback")
  leaveRequiresApproval           Boolean          @default(false) @map("leave_requires_approval")
  complaintPrivacyMode            ComplaintPrivacyMode @default(PRIVATE_IDENTIFIED) @map("complaint_privacy_mode")
  noShowWindowDays                Int              @default(30) @map("no_show_window_days")
  noShowWarningThreshold          Int              @default(3)  @map("no_show_warning_threshold")
  noShowDisableThreshold          Int              @default(5)  @map("no_show_disable_threshold")
  cancellationCutoffMinutes       Int              @default(60) @map("cancellation_cutoff_minutes")
  bookingHorizonDays              Int              @default(7)  @map("booking_horizon_days")       // Q
  dietTypeChangeCutoffMinutes     Int              @default(60) @map("diet_type_change_cutoff_minutes") // Q
  fillingFastThresholdPct         Int              @default(80) @map("filling_fast_threshold_pct") // Q
  recommendedMaxOccupancyPct      Int              @default(60) @map("recommended_max_occupancy_pct") // Q
  forecastLookbackDays            Int              @default(14) @map("forecast_lookback_days")
  collegeControlledFields         String[]         @default(["fullName","department","academicYear"]) @map("college_controlled_fields") // Q
  version                         Int              @default(1)
  updatedById                     String?          @map("updated_by_id") @db.Uuid
  updatedAt                       DateTime         @updatedAt @map("updated_at")
  @@map("mess_policy")
}

model MessPolicyHistory {
  id          String   @id @default(uuid()) @db.Uuid
  version     Int
  before      Json
  after       Json
  reason      String
  changedById String   @map("changed_by_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")
  @@index([createdAt])
  @@map("mess_policy_history")
}

// ───────────── Menus & closures ─────────────
model Menu {
  id           String     @id @default(uuid()) @db.Uuid
  mealDate     DateTime   @map("meal_date") @db.Date
  mealId       String     @map("meal_id") @db.Uuid
  status       MenuStatus @default(DRAFT)
  isSpecial    Boolean    @default(false) @map("is_special")   // special-meal day (Admin §F)
  specialTitle String?    @map("special_title")
  publishedAt  DateTime?  @map("published_at")
  contentHash  String?    @map("content_hash")  // detects "changed since last publish" for notifications
  version      Int        @default(1)
  items        MenuItem[]
  updatedAt    DateTime   @updatedAt @map("updated_at")
  @@unique([mealDate, mealId])
  @@map("menus")
}
model MenuItem {
  id        String    @id @default(uuid()) @db.Uuid
  menuId    String    @map("menu_id") @db.Uuid
  name      String
  dietType  DietType  @map("diet_type")
  sortOrder Int       @map("sort_order")
  deletedAt DateTime? @map("deleted_at")
  menu      Menu      @relation(fields: [menuId], references: [id])
  @@map("menu_items")
}

model MessClosure {
  id          String        @id @default(uuid()) @db.Uuid
  mealDate    DateTime      @map("meal_date") @db.Date
  kind        ClosureKind
  title       String
  reason      String
  status      ClosureStatus @default(ACTIVE)
  meals       MessClosureMeal[]
  createdById String        @map("created_by_id") @db.Uuid
  removedById String?       @map("removed_by_id") @db.Uuid
  removedAt   DateTime?     @map("removed_at")
  createdAt   DateTime      @default(now()) @map("created_at")
  @@index([mealDate, status])
  @@map("mess_closures")
}
model MessClosureMeal {
  closureId String      @map("closure_id") @db.Uuid
  mealId    String      @map("meal_id") @db.Uuid
  closure   MessClosure @relation(fields: [closureId], references: [id])
  @@id([closureId, mealId])
  @@map("mess_closure_meals")
}

// ───────────── Booking intent (3 separate sources, Rule 5) ─────────────
model MealPreference {               // Default Booking per meal (Spec §8)
  studentId          String    @map("student_id") @db.Uuid
  mealId             String    @map("meal_id") @db.Uuid
  isEnabled          Boolean   @default(false) @map("is_enabled")    // student's per-meal switch
  slotId             String?   @map("slot_id") @db.Uuid
  dietType           DietType  @default(VEG) @map("diet_type")
  autoDisabledAt     DateTime? @map("auto_disabled_at")              // set by no-show engine (Rule 10)
  autoDisabledByEventId String? @map("auto_disabled_by_event_id") @db.Uuid
  version            Int       @default(1)
  updatedAt          DateTime  @updatedAt @map("updated_at")
  @@id([studentId, mealId])
  @@map("meal_preferences")
}

model WeekdayRule {                  // Plan Ahead "Choose a Day" (Spec §6.2)
  id         String   @id @default(uuid()) @db.Uuid
  studentId  String   @map("student_id") @db.Uuid
  mealId     String   @map("meal_id") @db.Uuid
  weekdays   Int[]                                  // 0..6, IST
  slotId     String   @map("slot_id") @db.Uuid
  dietType   DietType @map("diet_type")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  @@index([studentId, mealId, isActive])
  @@map("weekday_rules")
}

model DateException {                // one-day change from Home or Plan Ahead (Spec §4.3, §6.1)
  id         String              @id @default(uuid()) @db.Uuid
  studentId  String              @map("student_id") @db.Uuid
  mealDate   DateTime            @map("meal_date") @db.Date
  mealId     String              @map("meal_id") @db.Uuid
  action     DateExceptionAction
  slotId     String?             @map("slot_id") @db.Uuid
  dietType   DietType?           @map("diet_type")
  origin     BookingSource                           // MANUAL | PLAN_AHEAD_DATE | ADMIN
  createdAt  DateTime            @default(now()) @map("created_at")
  updatedAt  DateTime            @updatedAt @map("updated_at")
  @@unique([studentId, mealDate, mealId])
  @@map("date_exceptions")
}

// ───────────── Materialized bookings ─────────────
model Booking {
  id                 String        @id @default(uuid()) @db.Uuid
  studentId          String        @map("student_id") @db.Uuid
  mealDate           DateTime      @map("meal_date") @db.Date
  mealId             String        @map("meal_id") @db.Uuid
  slotId             String        @map("slot_id") @db.Uuid
  dietType           DietType      @map("diet_type")
  source             BookingSource
  status             BookingStatus
  isOverCapacity     Boolean       @default(false) @map("is_over_capacity")
  cancelledAt        DateTime?     @map("cancelled_at")
  lastActorType      String        @map("last_actor_type")       // STUDENT | STAFF | SYSTEM
  lastActorStaffId   String?       @map("last_actor_staff_id") @db.Uuid  // drives "Updated by mess staff"
  lastOverrideReason String?       @map("last_override_reason")
  version            Int           @default(1)
  events             BookingEvent[]
  createdAt          DateTime      @default(now()) @map("created_at")
  updatedAt          DateTime      @updatedAt @map("updated_at")
  @@unique([studentId, mealDate, mealId])
  @@index([mealDate, mealId, slotId, status])     // capacity + dashboard
  @@index([status, mealDate])
  @@index([studentId, mealId, mealDate])
  @@map("bookings")
}

model BookingEvent {                 // per-booking timeline for detail view & reports (lead times)
  id          String        @id @default(uuid()) @db.Uuid
  bookingId   String        @map("booking_id") @db.Uuid
  type        String                                  // CREATED | SLOT_CHANGED | DIET_CHANGED | CANCELLED | STATUS_CORRECTED ...
  fromStatus  BookingStatus? @map("from_status")
  toStatus    BookingStatus? @map("to_status")
  payload     Json?
  actorType   String        @map("actor_type")
  actorStaffId String?      @map("actor_staff_id") @db.Uuid
  reason      String?
  createdAt   DateTime      @default(now()) @map("created_at")
  booking     Booking       @relation(fields: [bookingId], references: [id])
  @@index([bookingId, createdAt])
  @@map("booking_events")
}

model IdempotencyKey {
  id           String   @id @default(uuid()) @db.Uuid
  actorKey     String   @map("actor_key")     // "student:<id>" | "staff:<id>"
  key          String
  route        String
  requestHash  String   @map("request_hash")
  responseCode Int      @map("response_code")
  responseBody Json     @map("response_body")
  createdAt    DateTime @default(now()) @map("created_at")
  @@unique([actorKey, key])
  @@index([createdAt])
  @@map("idempotency_keys")
}

// ───────────── Leave ─────────────
model Leave {
  id            String      @id @default(uuid()) @db.Uuid
  studentId     String      @map("student_id") @db.Uuid
  startDate     DateTime    @map("start_date") @db.Date
  startMealType MealType    @map("start_meal_type")
  endDate       DateTime    @map("end_date") @db.Date
  endMealType   MealType    @map("end_meal_type")
  reason        String?
  status        LeaveStatus
  decidedById   String?     @map("decided_by_id") @db.Uuid
  decidedAt     DateTime?   @map("decided_at")
  rejectionReason String?   @map("rejection_reason")
  createdByStaffId String?  @map("created_by_staff_id") @db.Uuid
  version       Int         @default(1)
  changes       LeaveChange[]
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  @@index([studentId, status, startDate, endDate])
  @@index([status, startDate])
  @@map("leaves")
}
model LeaveChange {                  // extend / end early (resume point) / staff correction history
  id         String   @id @default(uuid()) @db.Uuid
  leaveId    String   @map("leave_id") @db.Uuid
  kind       String                                  // EXTENDED | ENDED_EARLY | CORRECTED
  before     Json
  after      Json
  actorType  String   @map("actor_type")
  actorStaffId String? @map("actor_staff_id") @db.Uuid
  reason     String?
  createdAt  DateTime @default(now()) @map("created_at")
  leave      Leave    @relation(fields: [leaveId], references: [id])
  @@map("leave_changes")
}

// ───────────── Attendance ─────────────
model AttendanceRecord {
  id             String           @id @default(uuid()) @db.Uuid
  bookingId      String?          @unique @map("booking_id") @db.Uuid
  studentId      String           @map("student_id") @db.Uuid
  mealDate       DateTime         @map("meal_date") @db.Date
  mealId         String           @map("meal_id") @db.Uuid
  source         AttendanceSource
  verifiedAt     DateTime?        @map("verified_at")    // ONLY from FACE_VERIFICATION; never fabricated
  recordedAt     DateTime         @map("recorded_at")    // when the record was written (manual/import)
  recordedById   String?          @map("recorded_by_id") @db.Uuid
  importJobId    String?          @map("import_job_id") @db.Uuid
  outageWindowId String?          @map("outage_window_id") @db.Uuid
  createdAt      DateTime         @default(now()) @map("created_at")
  @@unique([studentId, mealDate, mealId])
  @@index([mealDate, mealId])
  @@map("attendance_records")
}
model AttendanceOutageWindow {
  id          String    @id @default(uuid()) @db.Uuid
  startedAt   DateTime  @map("started_at")
  endedAt     DateTime? @map("ended_at")
  reason      String
  startedById String    @map("started_by_id") @db.Uuid
  endedById   String?   @map("ended_by_id") @db.Uuid
  @@index([startedAt, endedAt])
  @@map("attendance_outage_windows")
}

// ───────────── No-shows ─────────────
model NoShowEvent {
  id             String        @id @default(uuid()) @db.Uuid
  bookingId      String        @unique @map("booking_id") @db.Uuid
  studentId      String        @map("student_id") @db.Uuid
  mealDate       DateTime      @map("meal_date") @db.Date
  mealType       MealType      @map("meal_type")
  status         NoShowStatus
  exclusionCause NoShowExclusionCause? @map("exclusion_cause")
  excludedById   String?       @map("excluded_by_id") @db.Uuid
  excludedReason String?       @map("excluded_reason")
  createdAt      DateTime      @default(now()) @map("created_at")
  appeals        NoShowAppeal[]
  @@index([studentId, mealType, status, mealDate])   // rolling count
  @@index([status, mealDate])
  @@map("no_show_events")
}
model NoShowAppeal {
  id           String       @id @default(uuid()) @db.Uuid
  eventId      String       @map("event_id") @db.Uuid
  studentId    String       @map("student_id") @db.Uuid
  message      String
  status       AppealStatus @default(PENDING)
  decidedById  String?      @map("decided_by_id") @db.Uuid
  decidedAt    DateTime?    @map("decided_at")
  decisionReason String?    @map("decision_reason")
  createdAt    DateTime     @default(now()) @map("created_at")
  event        NoShowEvent  @relation(fields: [eventId], references: [id])
  @@index([status, createdAt])
  @@map("no_show_appeals")
}

// ───────────── Complaints ─────────────
model Complaint {
  id               String               @id @default(uuid()) @db.Uuid
  referenceCode    String               @unique @map("reference_code")   // shown to student (Spec §12 Submit)
  studentId        String?              @map("student_id") @db.Uuid     // NULL when submitted under ANONYMOUS (Rule 12)
  hostelBlockId    String?              @map("hostel_block_id") @db.Uuid // NULL under ANONYMOUS too (would de-anonymize)
  privacyMode      ComplaintPrivacyMode @map("privacy_mode")             // snapshot at submission
  submitterTokenHash String?            @map("submitter_token_hash")     // lets an anonymous submitter see status (Q)
  type             ComplaintType
  category         ComplaintCategory
  mealType         MealType?            @map("meal_type")
  mealDate         DateTime?            @map("meal_date") @db.Date
  description      String
  status           ComplaintStatus      @default(NEW)
  assignedToId     String?              @map("assigned_to_id") @db.Uuid
  studentResponse  String?              @map("student_response")
  resolvedAt       DateTime?            @map("resolved_at")
  version          Int                  @default(1)
  photos           ComplaintPhoto[]
  notes            ComplaintNote[]
  statusHistory    ComplaintStatusHistory[]
  createdAt        DateTime             @default(now()) @map("created_at")
  updatedAt        DateTime             @updatedAt @map("updated_at")
  @@index([status, createdAt])
  @@index([category, mealType, mealDate])
  @@index([studentId, createdAt])
  @@map("complaints")
}
model ComplaintPhoto {
  id          String    @id @default(uuid()) @db.Uuid
  complaintId String    @map("complaint_id") @db.Uuid
  storageKey  String    @map("storage_key")
  mimeType    String    @map("mime_type")
  sizeBytes   Int       @map("size_bytes")
  complaint   Complaint @relation(fields: [complaintId], references: [id])
  @@map("complaint_photos")
}
model ComplaintNote {                // internal, never exposed on student API
  id          String    @id @default(uuid()) @db.Uuid
  complaintId String    @map("complaint_id") @db.Uuid
  authorId    String    @map("author_id") @db.Uuid
  body        String
  createdAt   DateTime  @default(now()) @map("created_at")
  complaint   Complaint @relation(fields: [complaintId], references: [id])
  @@map("complaint_notes")
}
model ComplaintStatusHistory {
  id          String          @id @default(uuid()) @db.Uuid
  complaintId String          @map("complaint_id") @db.Uuid
  fromStatus  ComplaintStatus? @map("from_status")
  toStatus    ComplaintStatus @map("to_status")
  actorId     String?         @map("actor_id") @db.Uuid
  createdAt   DateTime        @default(now()) @map("created_at")
  complaint   Complaint       @relation(fields: [complaintId], references: [id])
  @@index([complaintId, createdAt])
  @@map("complaint_status_history")
}

// ───────────── Notifications & announcements ─────────────
model Notification {
  id                String               @id @default(uuid()) @db.Uuid
  studentId         String               @map("student_id") @db.Uuid
  category          NotificationCategory
  title             String
  body              String
  relatedEntityType String?              @map("related_entity_type")
  relatedEntityId   String?              @map("related_entity_id")
  dedupeKey         String?              @unique @map("dedupe_key")   // e.g. "reminder:cancel:<bookingId>"
  readAt            DateTime?            @map("read_at")
  createdAt         DateTime             @default(now()) @map("created_at")
  @@index([studentId, readAt, createdAt])
  @@map("notifications")
}
model Announcement {
  id            String               @id @default(uuid()) @db.Uuid
  title         String
  body          String
  category      String
  audienceType  AnnouncementAudience @map("audience_type")
  audienceFilter Json                @map("audience_filter")   // { hostelIds?, blockIds?, academicYears?, studentIds? }
  channels      String[]                                       // IN_APP, PUSH
  status        AnnouncementStatus   @default(DRAFT)
  scheduledFor  DateTime?            @map("scheduled_for")
  sentAt        DateTime?            @map("sent_at")
  createdById   String               @map("created_by_id") @db.Uuid
  version       Int                  @default(1)
  deliveries    AnnouncementDelivery[]
  createdAt     DateTime             @default(now()) @map("created_at")
  updatedAt     DateTime             @updatedAt @map("updated_at")
  @@index([status, scheduledFor])
  @@map("announcements")
}
model AnnouncementDelivery {
  id             String         @id @default(uuid()) @db.Uuid
  announcementId String         @map("announcement_id") @db.Uuid
  studentId      String         @map("student_id") @db.Uuid
  channel        String
  status         DeliveryStatus @default(PENDING)
  error          String?
  deliveredAt    DateTime?      @map("delivered_at")
  announcement   Announcement   @relation(fields: [announcementId], references: [id])
  @@unique([announcementId, studentId, channel])
  @@map("announcement_deliveries")
}

// ───────────── Staff, RBAC, audit ─────────────
model StaffUser {
  id                 String      @id @default(uuid()) @db.Uuid
  email              String      @unique
  fullName           String      @map("full_name")
  passwordHash       String      @map("password_hash")
  status             StaffStatus @default(ACTIVE)
  mustChangePassword Boolean     @default(true) @map("must_change_password")
  passwordChangedAt  DateTime?   @map("password_changed_at")
  failedLoginCount   Int         @default(0) @map("failed_login_count")
  lockedUntil        DateTime?   @map("locked_until")
  totpEnabled        Boolean     @default(false) @map("totp_enabled")
  totpSecretEnc      String?     @map("totp_secret_enc")   // AES-GCM with key from .env
  deletedAt          DateTime?   @map("deleted_at")
  version            Int         @default(1)
  roles              StaffUserRole[]
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")
  @@map("staff_users")
}
model Role {
  id          String           @id @default(uuid()) @db.Uuid
  key         String           @unique                 // SUPER_ADMIN, MESS_MANAGER, ...
  name        String
  isSystem    Boolean          @default(true) @map("is_system")
  permissions RolePermission[]
  staff       StaffUserRole[]
  @@map("roles")
}
model Permission {
  key         String           @id                      // "bookings:override" (synced from @ennel/shared)
  description String
  roles       RolePermission[]
  @@map("permissions")
}
model RolePermission {
  roleId        String     @map("role_id") @db.Uuid
  permissionKey String     @map("permission_key")
  role          Role       @relation(fields: [roleId], references: [id])
  permission    Permission @relation(fields: [permissionKey], references: [key])
  @@id([roleId, permissionKey])
  @@map("role_permissions")
}
model StaffUserRole {
  staffUserId String    @map("staff_user_id") @db.Uuid
  roleId      String    @map("role_id") @db.Uuid
  staffUser   StaffUser @relation(fields: [staffUserId], references: [id])
  role        Role      @relation(fields: [roleId], references: [id])
  @@id([staffUserId, roleId])
  @@map("staff_user_roles")
}
model StaffSession {
  id           String    @id @default(uuid()) @db.Uuid
  staffUserId  String    @map("staff_user_id") @db.Uuid
  familyId     String    @map("family_id") @db.Uuid
  tokenHash    String    @unique @map("token_hash")
  replacedById String?   @map("replaced_by_id") @db.Uuid
  userAgent    String?   @map("user_agent")
  ip           String?
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  lastUsedAt   DateTime? @map("last_used_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  @@index([staffUserId, revokedAt])
  @@map("staff_sessions")
}
model AuditLog {                     // INSERT/SELECT only for app DB user (Admin §P)
  id          String   @id @default(uuid()) @db.Uuid
  actorId     String?  @map("actor_id") @db.Uuid     // NULL for SYSTEM jobs
  actorType   String   @map("actor_type")            // STAFF | SYSTEM
  actorRoles  String[] @map("actor_roles")
  action      String                                  // "booking.override.cancel"
  entityType  String   @map("entity_type")
  entityId    String   @map("entity_id")
  before      Json?
  after       Json?
  reason      String?
  isOverride  Boolean  @default(false) @map("is_override")
  ip          String?
  userAgent   String?  @map("user_agent")
  requestId   String?  @map("request_id")
  createdAt   DateTime @default(now()) @map("created_at")
  @@index([entityType, entityId, createdAt])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}

// ───────────── Imports & jobs ─────────────
model ImportJob {
  id           String          @id @default(uuid()) @db.Uuid
  type         ImportJobType
  status       ImportJobStatus
  fileName     String          @map("file_name")
  storageKey   String          @map("storage_key")
  context      Json?                                    // e.g. { mealDate, mealType } for attendance
  totalRows    Int             @default(0) @map("total_rows")
  validRows    Int             @default(0) @map("valid_rows")
  invalidRows  Int             @default(0) @map("invalid_rows")
  createdById  String          @map("created_by_id") @db.Uuid
  confirmedAt  DateTime?       @map("confirmed_at")
  completedAt  DateTime?       @map("completed_at")
  rows         ImportJobRow[]
  createdAt    DateTime        @default(now()) @map("created_at")
  @@index([type, createdAt])
  @@map("import_jobs")
}
model ImportJobRow {
  id          String           @id @default(uuid()) @db.Uuid
  importJobId String           @map("import_job_id") @db.Uuid
  rowNumber   Int              @map("row_number")
  raw         Json
  outcome     ImportRowOutcome
  errors      Json?
  importJob   ImportJob        @relation(fields: [importJobId], references: [id])
  @@index([importJobId, outcome])
  @@map("import_job_rows")
}
model JobRun {                       // System health (Admin §Q); BullMQ remains the queue of record
  id         String       @id @default(uuid()) @db.Uuid
  jobName    String       @map("job_name")
  runKey     String       @map("run_key")          // idempotency, e.g. "close-window:2026-10-19:LUNCH"
  status     JobRunStatus
  startedAt  DateTime     @map("started_at")
  finishedAt DateTime?    @map("finished_at")
  error      String?
  stats      Json?
  @@unique([jobName, runKey])
  @@index([jobName, startedAt])
  @@map("job_runs")
}
```

Relations to `Student`/`StaffUser` from the operational tables (bookings, leaves, etc.) will be added as proper `@relation`s in the real file; they are omitted above only to keep the draft readable.

---

## 3. RBAC matrix (default roles)

Permission keys live in `packages/shared/src/permissions/permission-keys.ts`; the DB `permissions` table is synced from it by the seed. Legend: ✓ granted, · not granted, **?** my assumption, needs confirmation (see §5).

| Permission                                                  | SUPER_ADMIN | MESS_MANAGER | MESS_STAFF | WARDEN | AUDITOR |
| ----------------------------------------------------------- | :---------: | :----------: | :--------: | :----: | :-----: |
| `dashboard:read` (any date)                                 |      ✓      |      ✓       |     ·      | ✓**?** |    ·    |
| `dashboard:read-today`                                      |      ✓      |      ✓       |     ✓      |   ✓    |    ·    |
| `staff:read` / `staff:manage`                               |      ✓      |      ·       |     ·      |   ·    |    ·    |
| `roles:manage`                                              |      ✓      |      ·       |     ·      |   ·    |    ·    |
| `policy:read`                                               |      ✓      |      ✓       |     ·      |   ✓    |    ✓    |
| `policy:update`                                             |      ✓      |    ·**?**    |     ·      |   ·    |    ·    |
| `mess-config:read`                                          |      ✓      |      ✓       |     ✓      |   ·    |    ·    |
| `mess-config:update` (meals, slots, capacities, thresholds) |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `menus:read`                                                |      ✓      |      ✓       |     ✓      |   ✓    |    ·    |
| `menus:update` / `menus:publish`                            |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `closures:read`                                             |      ✓      |      ✓       |     ✓      |   ✓    |    ·    |
| `closures:manage`                                           |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `students:read`                                             |      ✓      |    ✓**?**    |     ·      |   ✓    |    ·    |
| `students:update` (college fields, bulk hostel)             |      ✓      |      ·       |     ·      | ·**?** |    ·    |
| `students:lock` / `students:deactivate`                     |      ✓      |      ·       |     ·      | ·**?** |    ·    |
| `students:reset-credentials`                                |      ✓      |      ·       |     ·      | ·**?** |    ·    |
| `roster:import`                                             |      ✓      |    ·**?**    |     ·      |   ·    |    ·    |
| `bookings:read`                                             |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `bookings:override` (create/cancel/move/correct)            |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `bookings:bulk`                                             |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `attendance:read` (live counter)                            |      ✓      |      ✓       |     ✓      |   ·    |    ·    |
| `attendance:mark`                                           |      ✓      |      ✓       |     ✓      |   ·    |    ·    |
| `attendance:import`                                         |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `attendance:outage-toggle`                                  |      ✓      |      ✓       |   ·**?**   |   ·    |    ·    |
| `no-shows:read`                                             |      ✓      |      ✓       |     ·      | ·**?** |    ·    |
| `no-shows:review-appeal`                                    |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `no-shows:reset` (reset count, re-enable Default Booking)   |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `leaves:read`                                               |      ✓      |      ✓       |     ·      |   ✓    |    ·    |
| `leaves:approve`                                            |      ✓      |      ✓       |     ·      |   ✓    |    ·    |
| `leaves:manage` (create/end/correct on behalf)              |      ✓      |      ✓       |     ·      | ·**?** |    ·    |
| `complaints:read`                                           |      ✓      |      ✓       |     ·      |   ✓    |    ·    |
| `complaints:resolve` (status, student response)             |      ✓      |      ✓       |     ·      |   ✓    |    ·    |
| `complaints:note`                                           |      ✓      |      ✓       |     ·      |   ✓    |    ·    |
| `complaints:assign`                                         |      ✓      |      ✓       |     ·      | ·**?** |    ·    |
| `announcements:read`                                        |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `announcements:manage` (draft, schedule, send)              |      ✓      |      ✓       |     ·      |   ·    |    ·    |
| `forecasting:read` / `forecasting:export`                   |      ✓      |      ✓       |     ✓      |   ·    |    ·    |
| `reports:read`                                              |      ✓      |      ✓       |     ·      |   ✓    |    ✓    |
| `reports:export`                                            |      ✓      |      ✓       |     ·      | ✓**?** |    ✓    |
| `audit-log:read` / `audit-log:export`                       |      ✓      |      ·       |     ·      |   ·    |    ✓    |
| `system:read`                                               |      ✓      |    ✓**?**    |     ·      |   ·    |    ·    |
| `system:manage` (retry failed jobs)                         |      ✓      |      ·       |     ·      |   ·    |    ·    |

Always allowed for any authenticated staff (no key): own profile, own password change, own TOTP setup, own session list / "log out everywhere".
Enforcement: `@RequirePermissions(...)` on every admin route; a CI-style test enumerates all admin routes and fails if one lacks the decorator.

---

## 4. Phase 0 plan

### 4.1 Prerequisites (blocking, needs you)

On this machine `node`, `pnpm`, `git` and `docker` are **not installed / not on PATH**. Before scaffolding I need:

- Node.js 20 LTS or 22 LTS (then `corepack enable` for pnpm 9)
- Git for Windows
- Docker Desktop (for `docker-compose.dev.yml` Postgres + Redis), or tell me to target a native Postgres 16 + Redis/Memurai install instead.

### 4.2 Deliverables

| #   | Work                                                                                                                                                                                                                                                                                                                                                                                                                                    | Files                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | `git init`, `.gitignore`, `.editorconfig`, `.env.example`; move the spec docx to `docs/source/` and convert it to `docs/ennel-spec.md` (verbatim text, section numbers kept)                                                                                                                                                                                                                                                            | root, `docs/`            |
| 2   | Workspace tooling: `pnpm-workspace.yaml`, `tsconfig.base.json` (strict), ESLint 9 **flat config** (`eslint.config.mjs`: ESLint 9 no longer reads `.eslintrc`), Prettier, Husky + lint-staged, Commitlint                                                                                                                                                                                                                                | root                     |
| 3   | `packages/shared`: enums, permission keys + default role map, error codes, pagination/error Zod schemas, theme tokens; Vitest                                                                                                                                                                                                                                                                                                           | `packages/shared/src/**` |
| 4   | `apps/api`: Nest 11 skeleton, Zod-validated config, `AppError` + global exception filter, request-ID + JSON logging, `Clock`/`SystemClock`/`FakeClock`, `PrismaService` + `TransactionRunner`, Swagger at `/api/docs`, `GET /api/v1/health`; Prisma schema (§2) + initial migration + audit-log grant migration; seed skeleton (meals, slots from the spec timetable, default policy, roles/permissions, first Super Admin from `.env`) | `apps/api/**`            |
| 5   | `apps/admin`: Vite + React + Router + TanStack Query + Tailwind + shadcn/ui init, theme from shared tokens, Inter font, placeholder login and shell                                                                                                                                                                                                                                                                                     | `apps/admin/**`          |
| 6   | `apps/mobile`: Expo (managed) + Expo Router + NativeWind skeleton, theme tokens, Inter font, splash route                                                                                                                                                                                                                                                                                                                               | `apps/mobile/**`         |
| 7   | `docker-compose.dev.yml` (Postgres 16, Redis 7 only)                                                                                                                                                                                                                                                                                                                                                                                    | root                     |
| 8   | Docs: `architecture.md`, `business-rules.md`, `admin-requirements.md` (Admin §A–Q as _assumptions to confirm_), `rbac-matrix.md` (§3), draft `api-contract.md` (conventions + endpoint inventory per phase), ADRs                                                                                                                                                                                                                       | `docs/**`                |
| 9   | Extend `CLAUDE.md` with stack, layout, commands, naming conventions                                                                                                                                                                                                                                                                                                                                                                     | `CLAUDE.md`              |
| 10  | Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `prisma validate`, `prisma migrate dev` against compose Postgres, seed runs                                                                                                                                                                                                                                                                                                         | —                        |

### 4.3 ADRs to write

0001 Modular monolith + monorepo · 0002 Business time zone, date and slot-time storage · 0003 Intent tables vs. materialized bookings · 0004 Capacity locking via advisory lock · 0005 `allowOverCapacityBooking` · 0006 `defaultSlotFullFallback` · 0007 `leaveRequiresApproval` · 0008 `complaintPrivacyMode` (incl. anonymous data handling) · 0009 No-show window/thresholds and re-enable behaviour · 0010 `cancellationCutoffMinutes` + change-slot deadline · 0011 `bookingHorizonDays` · 0012 `dietTypeChangeCutoffMinutes` · 0013 Availability label thresholds · 0014 Date exception beats weekday rule (Spec §6.2 recommendation) · 0015 Separate student/staff token audiences and secrets · 0016 Idempotency keys · 0017 Closure removal restores eligibility via the resolver · 0018 College-controlled profile fields · 0019 Staff credential-reset flow without email.

### 4.4 Commits (Conventional Commits)

`chore: initialize monorepo tooling` → `feat(shared): add enums, permissions and error codes` → `feat(api): scaffold nest app with config, errors and logging` → `feat(api): add prisma schema and initial migration` → `feat(api): add dev seed` → `feat(admin): scaffold vite admin app` → `feat(mobile): scaffold expo app` → `docs: add architecture, business rules, rbac matrix and ADRs`.

---

## 5. Open questions (need your input)

**Policy defaults** (I'll ship the safe default shown and record an ADR if you don't decide now):

1. **Naming:** OK to use `DietType` (VEG/NON_VEG) and rename the flag to `dietTypeChangeCutoffMinutes`? Default: yes.
2. **`bookingHorizonDays`:** not specified. Default **7**.
3. **Diet-type change cutoff** (Spec §18.4): default **60 min before slot start**, same as cancellation.
4. **Availability thresholds** (Spec §18.3): default `FILLING_FAST` at ≥80% of official capacity, `FULL` at 100%, `RECOMMENDED` = the least-occupied active slot of that meal if it is ≤60%.
5. **No-show re-enable:** after auto-disable, when can Default Booking come back? Default: it stays off; the student can switch it back on once their rolling count is below the disable threshold, and staff can re-enable any time with a reason.
6. **Attendance window close:** default = meal service end + 0 min grace (configurable per meal).
7. **Breakfast cancellation deadline:** default 60 min before the breakfast window start (6:00 AM for 7:00 AM).
8. **Ending leave early:** may the resume point be in the past or within the cancellation cutoff? Default: earliest resume point = first meal whose cancellation deadline has not passed.
9. **Closure removal:** default = re-run the resolver for affected students; `CANCELLED_BY_CLOSURE` bookings are re-created as `BOOKED` only where intent still resolves to a booking and capacity allows, and students are notified.

**Data / college / integration:** 10. **College-controlled fields** (Spec §18.11): default read-only = reference number, full name, department, academic year. Hostel/room editable by student? 11. **Reference-number format** (e.g. "24 900 417"): store digits only and strip spaces? Any length/checksum rule? 12. **Password policy:** default min 8 chars for students, min 12 + not equal to email for staff; lockout after 5 failed attempts for 15 minutes. 13. **Credential reset without email/SMS:** default = staff generate a one-time code (shown once, expires in 24 h) that the student enters with their reference number. Is email or SMS available? 14. **Anonymous complaints:** in `ANONYMOUS` mode I won't store `student_id` or hostel. The student then can't receive status notifications; "My Reports" would work only via a device-held receipt token. Acceptable? 15. **Real timetable/capacities:** confirm breakfast window and real slot capacities. The seed will use spec times with capacity 500 as **placeholders**. 16. **Face-verification API:** no access yet, so mock only (as briefed).

**RBAC assumptions** (marked **?** in §3): 17. Does MESS_MANAGER need `students:read` to book on a student's behalf? (Assumed yes.) Should they also have `roster:import`? (Assumed no, Super Admin only.) 18. Is `policy:update` Super Admin only? (Assumed yes. Admin §D lists the policy page under config, but §A says policy belongs to Super Admin.) 19. Can MESS_STAFF toggle outage mode at the counter? (Assumed no.) 20. WARDEN: give dashboard-any-date, `reports:export`, `leaves:manage`, `complaints:assign`, `no-shows:read`, or student lock/reset? (Assumed only `reports:export` and the today dashboard.) 21. MESS_MANAGER `system:read`? (Assumed yes, read-only.)

**Tooling:** 22. ESLint 9 flat config instead of `.eslintrc` (the prompt names `.eslintrc`): OK? 23. Tests: **Vitest** for shared/admin/api domain + Jest (jest-expo) for mobile, since RN Testing Library is most reliable on Jest. OK?
