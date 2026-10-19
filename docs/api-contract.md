# ENNEL API Contract (draft)

Status: **Phase 1 endpoints implemented** (marked ✅, detailed in §2.1). Conventions are fixed. The rest of the inventory is a plan, and each phase finalizes its endpoints here and in Swagger (`/api/docs`). Request/response schemas are the Zod schemas in `@ennel/shared/schemas`.

## 1. Conventions

| Topic       | Rule                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Base paths  | Student `/api/v1`, staff `/api/v1/admin`                                                                                                       |
| Resources   | Plural kebab-case nouns (`/bookings`, `/no-show-appeals`); actions as sub-resources (`POST /bookings/{id}/cancel`)                             |
| JSON        | `camelCase`; dates `YYYY-MM-DD` (IST business date); instants ISO-8601 UTC (`2026-10-19T04:30:00.000Z`); clients format them in IST with AM/PM |
| Auth        | `Authorization: Bearer <access>`; refresh via `POST …/auth/refresh` with the refresh token in the body (mobile) or an httpOnly cookie (admin)  |
| Idempotency | `Idempotency-Key: <uuid>` **required** on booking create/change/cancel, leave create/extend/end, complaint create                              |
| Concurrency | Edited records carry `version`; send it back on PATCH; a stale version returns `409 VERSION_CONFLICT`                                          |
| Overrides   | Admin overrides require `reason` (non-empty, ≤500 chars), else `422 OVERRIDE_REASON_REQUIRED`                                                  |
| Request ID  | Responses carry `X-Request-Id`; also echoed in error bodies                                                                                    |

### 1.1 Lists

Query: `page` (≥1, default 1), `pageSize` (1–100, default 20), `sortBy`, `sortOrder` (`asc`|`desc`), `q`, plus resource filters.
Response: `{ "items": [...], "total": 123, "page": 1, "pageSize": 20 }`.

### 1.2 Errors

```json
{
  "code": "BOOKING_DEADLINE_PASSED",
  "message": "Cancellation closed at 10:00 AM.",
  "details": { "deadlineAt": "2026-10-19T04:30:00.000Z" },
  "requestId": "…"
}
```

| Code                       | HTTP | Meaning                                            |
| -------------------------- | ---- | -------------------------------------------------- |
| `VALIDATION_FAILED`        | 400  | Input failed schema validation (`details.issues`)  |
| `UNAUTHENTICATED`          | 401  | Missing/invalid/expired token or wrong audience    |
| `INVALID_CREDENTIALS`      | 401  | Login failed (no hint whether the account exists)  |
| `ACCOUNT_LOCKED`           | 423  | Lockout or staff-locked account                    |
| `PASSWORD_CHANGE_REQUIRED` | 403  | Staff must change password before other calls      |
| `PERMISSION_DENIED`        | 403  | Missing permission                                 |
| `NOT_FOUND`                | 404  | Resource missing or not visible to caller          |
| `VERSION_CONFLICT`         | 409  | Optimistic-lock mismatch                           |
| `IDEMPOTENCY_KEY_REUSED`   | 409  | Same key, different payload                        |
| `ROSTER_NOT_FOUND`         | 404  | Reference number not in the active roster          |
| `ALREADY_REGISTERED`       | 409  | Reference number already has an account            |
| `BOOKING_DEADLINE_PASSED`  | 422  | Cancel/change/diet deadline passed                 |
| `SLOT_UNAVAILABLE`         | 422  | Slot full (no over-capacity), disabled, or closed  |
| `BOOKING_NOT_ALLOWED`      | 422  | Date outside horizon, on leave, or mess closed     |
| `LEAVE_RANGE_INVALID`      | 422  | End before start, overlap, or invalid resume point |
| `OVERRIDE_REASON_REQUIRED` | 422  | Missing reason on an override                      |
| `ROSTER_IMPORT_INVALID`    | 422  | Import confirm attempted with blocking errors      |
| `FILE_INVALID`             | 422  | Upload type/size invalid                           |
| `RATE_LIMITED`             | 429  | Too many requests                                  |
| `INTERNAL_ERROR`           | 500  | Unexpected failure (no internals leaked)           |

## 2. Student API inventory (`/api/v1`)

| Phase | Method & path                                                                                                           | Purpose                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 0     | `GET /health`                                                                                                           | Liveness                                                                            |
| 1 ✅  | `POST /auth/roster-check` · `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`     | Account creation and sessions (§2.1)                                                |
| 1 ✅  | `GET /me` · `PATCH /me/profile` · `PUT /me/photo` · `PUT /me/onboarding`                                                | Profile and first-time setup (§2.1)                                                 |
| 1 ✅  | `GET /hostels` · `GET /meals`                                                                                           | Hostel/block options; meals with their active slots                                 |
| 1 ✅  | `GET /files/{key}?exp&sig`                                                                                              | Signed, expiring file URLs (photos); the signature is the authorization             |
| 2     | `POST /auth/reset-with-code`                                                                                            | Complete a staff-issued credential reset (moved from Phase 1: needs the staff side) |
| 3     | `GET /slots/availability?date&meal`                                                                                     | Live slot availability                                                              |
| 4     | `GET /days/{date}`                                                                                                      | Home: 3 meal cards with status label, deadlines, allowed actions                    |
| 4     | `POST /bookings` · `PATCH /bookings/{id}` · `POST /bookings/{id}/cancel` · `POST /days/{date}/cancel-eligible`          | Book, change slot/diet, cancel, cancel today's meals                                |
| 5     | `GET /default-preferences` · `PUT /default-preferences` · `PATCH /default-preferences/{meal}`                           | Default Booking                                                                     |
| 6     | `GET/POST /weekday-rules` · `PATCH/DELETE /weekday-rules/{id}`                                                          | Plan Ahead weekday rules                                                            |
| 7     | `GET /bookings/history` · `GET /bookings/{id}`                                                                          | My Bookings                                                                         |
| 8     | `GET/POST /leaves` · `GET /leaves/{id}` · `POST /leaves/{id}/extend` · `POST /leaves/{id}/end` · `POST /leaves/preview` | Leave                                                                               |
| 9     | `GET /no-shows/summary` · `POST /no-shows/{id}/appeals`                                                                 | Counts, warnings, report incorrect record                                           |
| 10    | `GET/POST /complaints` · `GET /complaints/{id}` · `POST /complaints/photos`                                             | Complaints                                                                          |
| 10    | `GET /notifications` · `POST /notifications/{id}/read` · `POST /notifications/read-all` · `PUT /push-tokens`            | Notifications                                                                       |
| dev   | `POST /dev/attendance`                                                                                                  | Drive `MockAttendanceProvider` (only when `NODE_ENV=development`)                   |

### 2.1 Phase 1 endpoints

Bodies are validated with the named `@ennel/shared` schema; errors use §1.2. `AuthSession` = `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, isOnboardingComplete }`.

| Endpoint                  | Body → response                                                   | Errors                                                                                                                                        | Notes                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/roster-check` | `rosterCheckRequestSchema` → `{ status: NEW \| REGISTERED }`      | `ROSTER_NOT_FOUND` (unknown or inactive)                                                                                                      | Reference number normalized to digits. 20/min per IP                                                                                                                                          |
| `POST /auth/register`     | `registerRequestSchema` → `AuthSession` (201)                     | `VALIDATION_FAILED` (incl. "Passwords do not match."), `ROSTER_NOT_FOUND`, `ALREADY_REGISTERED`                                               | Copies college data from the roster. 10/min per IP                                                                                                                                            |
| `POST /auth/login`        | `loginRequestSchema` → `AuthSession`                              | `INVALID_CREDENTIALS` (same for unknown accounts), `ACCOUNT_LOCKED` (`details.lockedUntil`; also locked/deactivated accounts), `RATE_LIMITED` | 5 failures → 15-minute lock. 10/min per IP                                                                                                                                                    |
| `POST /auth/refresh`      | `{ refreshToken }` → `AuthSession`                                | `UNAUTHENTICATED`, `ACCOUNT_LOCKED`                                                                                                           | Rotates the token. Reusing an old token revokes the whole session family, so clients refresh one at a time                                                                                    |
| `POST /auth/logout`       | `{ refreshToken }` → 204                                          | none                                                                                                                                          | Revokes the session family; unknown tokens are ignored                                                                                                                                        |
| `GET /me`                 | → `StudentProfile`                                                | `UNAUTHENTICATED`                                                                                                                             | Includes `editableFields` and a signed `photoUrl` (15 minutes)                                                                                                                                |
| `PATCH /me/profile`       | `updateProfileRequestSchema` (incl. `version`) → `StudentProfile` | `VALIDATION_FAILED` (college-controlled field, unknown block), `VERSION_CONFLICT`                                                             | Unknown fields are rejected                                                                                                                                                                   |
| `PUT /me/photo`           | multipart field `photo` → `StudentProfile`                        | `FILE_INVALID`                                                                                                                                | JPEG/PNG/WebP/HEIC detected from content, ≤5 MB; replaces the previous photo                                                                                                                  |
| `PUT /me/onboarding`      | `completeOnboardingRequestSchema` → `StudentProfile`              | `VALIDATION_FAILED` (paths `mealPreferences.<MEAL>`)                                                                                          | One transaction: profile, 3 meal preferences, `onboardingCompletedAt`. College-controlled values are ignored. Bookings are generated from these preferences by the booking engine (Phase 4/5) |
| `GET /hostels`            | → `{ items: HostelOption[] }`                                     | `UNAUTHENTICATED`                                                                                                                             | Active hostels and blocks                                                                                                                                                                     |
| `GET /meals`              | → `{ items: MealConfig[] }`                                       | `UNAUTHENTICATED`                                                                                                                             | Active meals in serving order with active slots                                                                                                                                               |

## 3. Admin API inventory (`/api/v1/admin`)

| Phase | Method & path                                                                                                                                                                                                                                  | Permission                                      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 2     | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/totp/verify`                                                                                                                                                     | public / —                                      |
| 2     | `GET /auth/me` · `POST /auth/change-password` · `POST /auth/totp/enroll` · `GET /auth/sessions` · `POST /auth/sessions/revoke-all`                                                                                                             | authenticated                                   |
| 2     | `GET/POST /staff-users` · `PATCH /staff-users/{id}` · `POST /staff-users/{id}/disable`                                                                                                                                                         | `staff:read` / `staff:manage`                   |
| 2     | `GET /roles` · `PUT /roles/{id}/permissions` · `PUT /staff-users/{id}/roles`                                                                                                                                                                   | `roles:manage`                                  |
| 2     | `GET /audit-logs` · `GET /audit-logs/export`                                                                                                                                                                                                   | `audit-log:read` / `audit-log:export`           |
| 2     | `POST /roster-imports` · `GET /roster-imports/{id}` · `GET /roster-imports/{id}/rows` · `POST /roster-imports/{id}/confirm`                                                                                                                    | `roster:import`                                 |
| 2     | `GET /students` · `GET /students/{id}`                                                                                                                                                                                                         | `students:read`                                 |
| 2     | `PATCH /students/{id}` · `POST /students/bulk-hostel`                                                                                                                                                                                          | `students:update`                               |
| 2     | `POST /students/{id}/lock` · `/unlock`                                                                                                                                                                                                         | `students:lock`                                 |
| 2     | `POST /students/{id}/deactivate` · `/reactivate`                                                                                                                                                                                               | `students:deactivate`                           |
| 2     | `POST /students/{id}/credential-resets`                                                                                                                                                                                                        | `students:reset-credentials`                    |
| 2     | `GET /meals` · `PATCH /meals/{id}` · `GET/POST /slots` · `PATCH /slots/{id}` · `POST /slots/{id}/disable` · `PUT /slots/{id}/weekday-capacities` · `PUT/DELETE /slots/{id}/capacity-overrides/{date}` · `GET /slots/{id}/impact?capacity&date` | `mess-config:read` / `mess-config:update`       |
| 2     | `GET /policy` · `GET /policy/history` · `PATCH /policy`                                                                                                                                                                                        | `policy:read` / `policy:update`                 |
| 2     | `GET /menus?from&to` · `PUT /menus/{date}/{meal}` · `POST /menus/copy-week` · `POST /menus/{id}/publish`                                                                                                                                       | `menus:read` / `menus:update` / `menus:publish` |
| 4     | `GET /bookings` · `POST /bookings` · `POST /bookings/{id}/cancel` · `POST /bookings/{id}/move` · `POST /bookings/{id}/correct-status` · `POST /bookings/bulk/preview` · `POST /bookings/bulk/apply`                                            | `bookings:*`                                    |
| 4     | `GET /dashboard?date`                                                                                                                                                                                                                          | `dashboard:read` / `dashboard:read-today`       |
| 5     | `GET/POST /closures` · `GET /closures/{id}/impact` · `DELETE /closures/{id}`                                                                                                                                                                   | `closures:*`                                    |
| 7     | `GET /attendance/live?meal` · `POST /attendance/marks` · `POST /attendance-imports` · `POST /attendance/outage/start` · `/end`                                                                                                                 | `attendance:*`                                  |
| 8     | `GET /leaves` · `POST /leaves/{id}/approve` · `/reject` · `POST /leaves` · `POST /leaves/{id}/end` · `PATCH /leaves/{id}`                                                                                                                      | `leaves:*`                                      |
| 9     | `GET /no-shows` · `GET /no-show-appeals` · `POST /no-show-appeals/{id}/approve` · `/reject` · `POST /students/{id}/no-shows/reset` · `POST /students/{id}/default-booking/re-enable`                                                           | `no-shows:*`                                    |
| 10    | `GET /complaints` · `GET /complaints/{id}` · `POST /complaints/{id}/status` · `POST /complaints/{id}/assign` · `POST /complaints/{id}/notes` · `GET /complaints/analytics` · `GET /complaints/{id}/photos/{photoId}/url`                       | `complaints:*`                                  |
| 10    | `GET/POST /announcements` · `PATCH /announcements/{id}` · `POST /announcements/{id}/schedule` · `/send` · `/cancel` · `POST /announcements/audience-preview`                                                                                   | `announcements:*`                               |
| 11    | `GET /forecasts?from&to` · `GET /forecasts/kitchen-sheet?format=pdf\|xlsx`                                                                                                                                                                     | `forecasting:*`                                 |
| 11    | `GET /reports/{type}` · `POST /reports/{type}/exports` · `GET /report-exports/{id}`                                                                                                                                                            | `reports:*`                                     |
| 11    | `GET /system/health` · `GET /system/jobs` · `POST /system/jobs/{id}/retry`                                                                                                                                                                     | `system:read` / `system:manage`                 |

No update or delete endpoint exists for audit logs (Admin §P).
