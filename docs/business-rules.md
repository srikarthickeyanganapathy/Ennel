# ENNEL Business Rules

Single source of truth for rule behaviour. Each rule has a stable ID (`BR-…`) that domain code and tests cite next to the spec reference. Values marked _policy_ come from `mess_policy` and are editable by staff with `policy:update`. The value shown is the current default, see the linked ADR.

Status: Phase 0 defaults approved 2026-10-19. The institution still has to confirm the items in Spec §18; see `docs/admin-requirements.md` §Open items.

## BR-TIME: Time

- **BR-TIME-1** Business time zone is **Asia/Kolkata**. "Today", weekdays, meal dates and deadlines are evaluated in IST. (ADR-0002)
- **BR-TIME-2** Instants are stored in UTC. Business dates are stored as calendar `DATE`. Slot and window times are minutes since IST midnight.
- **BR-TIME-3** Every displayed time uses 12-hour AM/PM (Spec §17).
- **BR-TIME-4** Domain functions never read the system clock; `now` is passed in.

## BR-MEAL: Meals and slots (Rule 1)

- **BR-MEAL-1** Meals are Breakfast, Lunch and Dinner (`MealType`). Breakfast is modelled as one slot that spans its serving window (seed default 7:00–8:30 AM, to be confirmed). Lunch has 5 slots and Dinner has 7 (Spec §5.1), all from the database.
- **BR-MEAL-2** Veg/Non-Veg is `DietType` in code. UI copy keeps the spec's wording "Meal type: Veg / Non-Veg".
- **BR-MEAL-3** A disabled slot keeps its history but cannot receive new bookings. A slot with future bookings cannot be deleted; staff disable it and reassign (Admin §D).
- **BR-MEAL-4** Slot integrity (Phase 2): a slot ends after it starts, lies inside its meal's serving window and does not overlap another active slot of the same meal. A serving window cannot be shrunk so that an active slot falls outside it. Breakfast keeps exactly one slot that follows its window, so it cannot get extra slots, be disabled or be deleted.
- **BR-MEAL-5** A slot is "in use" when it has future bookings or saved choices (Default Booking preferences, Plan Ahead weekday rules or date exceptions). Disabling an in-use slot needs a target slot (active, same meal); its future bookings and saved choices move there in the same transaction. Deleting is a soft delete and is allowed only for slots not in use. Every change takes a reason when it affects students and is audited. Moved bookings get a `SLOT_CHANGED` booking event with the reason and the staff member as last actor (shown to the student as "Updated by mess staff", Admin §H). Slot changes for one meal are serialized with a per-meal database lock so parallel edits cannot overlap or reassign into each other.
- **BR-MEAL-6** Official capacity for a slot on a date resolves as: per-date override, else the weekday capacity, else the slot's default capacity. Lowering a capacity below existing bookings is allowed but the admin sees the affected dates and counts first; existing bookings are never cancelled by a capacity change.

## BR-ROS: Roster import (Admin §G)

- **BR-ROS-1** Import is two steps: upload (validate only, nothing changes) and confirm. Files are CSV or XLSX, ≤5 MB; headers are matched case- and spacing-insensitively and unknown columns are ignored. Required columns: reference number, full name, department, academic year.
- **BR-ROS-2** Each row is classified: New, Update (lists changed fields), No change, Error (field-level messages) or Duplicate (the reference number appears more than once in the file). Hostel and block must both be blank or name an existing block; an unknown hostel/block is an Error, never created implicitly.
- **BR-ROS-3** Confirm is blocked (`ROSTER_IMPORT_INVALID`) while any row is Error or Duplicate. Confirm re-checks every row against the current roster inside the transaction, so a preview that went stale cannot write outdated data. A job can be confirmed once.
- **BR-ROS-4** Roster entries not in the file are left unchanged (no implicit deactivation). For an already registered student, college-controlled fields (BR-AUTH-7) are copied to their profile; fields students may edit are not overwritten.

## BR-MENU: Menus (Admin §E)

- **BR-MENU-1** A menu exists per date and meal, with items tagged Veg or Non-Veg, and is Draft until published. Students only see the published snapshot; later draft edits do not change it until the next publish.
- **BR-MENU-2** Copy-from-previous-week and the bulk weekly editor only write drafts.
- **BR-MENU-3** Publishing a menu whose items differ from the previously published snapshot, for a date with active bookings, sends an in-app "menu changed" notification to each booked student (once per published version). The first publish and an unchanged republish notify nobody. Push delivery arrives with the notifications phase.

## BR-STAFF: Staff accounts (Admin §A/§B)

- **BR-STAFF-1** New staff accounts and password resets get a random temporary password, shown once to the admin who created it; the staff member must change it at first login.
- **BR-STAFF-2** Staff cannot disable themselves or remove their own Super Admin role, and the last active Super Admin cannot be disabled or demoted. Disabling an account revokes its sessions. Only a Super Admin may reset, disable, enable or rename a Super Admin (ADR-0021).
- **BR-STAFF-3** Role and permission changes take effect on the next request (permissions are re-read, cached for at most 30 s).
- **BR-STAFF-4** TOTP 2FA is optional per staff member: enrolment turns on only after a correct code; staff with `staff:manage` can reset another member's 2FA with a reason. TOTP secrets are stored encrypted.

## BR-BOOK: Bookings

- **BR-BOOK-1** Sources: `DEFAULT`, `MANUAL`, `PLAN_AHEAD_DATE`, `PLAN_AHEAD_WEEKDAY`, `ADMIN` (Rule 2).
- **BR-BOOK-2** Statuses: `BOOKED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`, `PAUSED_LEAVE`, `CANCELLED_BY_CLOSURE` (Rule 3).
- **BR-BOOK-3** UI labels are derived and never stored (Spec §4.3):

  | Condition                                                                    | Label                     |
  | ---------------------------------------------------------------------------- | ------------------------- |
  | No booking, Default Booking off for the meal                                 | Not Booked — Default Off  |
  | `BOOKED`, source `DEFAULT`                                                   | Booked (Default)          |
  | `BOOKED`, source `PLAN_AHEAD_WEEKDAY`                                        | Booked (Weekday Rule)     |
  | `BOOKED`, source `MANUAL` / `PLAN_AHEAD_DATE`, no recurring booking that day | Booked Once               |
  | `BOOKED`, date exception differs from what a recurring rule would give       | Changed for This Day      |
  | `CANCELLED`                                                                  | Cancelled                 |
  | `PAUSED_LEAVE`                                                               | Booking Paused — On Leave |
  | `CANCELLED_BY_CLOSURE`                                                       | Mess Closed               |
  | `NO_SHOW`                                                                    | No-show                   |
  | `COMPLETED`                                                                  | Meal Completed            |

  If `last_actor_type = STAFF`, the booking detail also shows "Updated by mess staff" (Admin §H).

- **BR-BOOK-4 Resolution order** (Rule 4): **closure > approved leave > one-day date exception > weekday rule > Default Booking**. One pure function, `resolveEffectiveBooking`. A date exception beats a weekday rule for that date, and the app shows which rule applied (Spec §6.2, ADR-0014).
- **BR-BOOK-5** Default Booking, one-day exceptions and weekday rules are separate records and never overwrite each other. A one-time manual booking never turns Default Booking on (Rule 5, Spec §3 Screen 8).
- **BR-BOOK-6** Default Booking for a meal applies only when the overall switch is on, the meal switch is on, the meal is not auto-disabled by the no-show engine, and a slot is set (Spec §8.1). Weekday rules follow the overall switch and the auto-disable, but not the meal switch (BR-PLAN-4).
- **BR-BOOK-7** There is at most one booking per student/date/meal. A change of slot or diet updates that row and appends a `booking_events` entry.
- **BR-BOOK-8** Students may book dates from today up to today + `bookingHorizonDays` (_policy_, default **7**, ADR-0011).
- **BR-BOOK-9** A meal with Default Booking on but no booking yet (for example a full slot under `ASK_STUDENT`) is labelled "Not Booked". Student writes (book, change, cancel, cancel today's meals) are idempotent (BR-IDEM-1) and return the updated card. A cancelled meal can be booked again until the last slot starts (BR-DEAD-5).
- **BR-BOOK-10** Staff overrides (Admin §H, ADR-0022): book on behalf, cancel, move and correct status (Booked, Cancelled, Meal Completed only) with a mandatory reason and the version shown; they skip student deadlines and the booking period but follow closures, leave and capacity (except Meal Completed). Each writes an origin `ADMIN` date exception, sets the staff member as last actor (shown as "Updated by mess staff"), adds a booking event, and writes an override audit entry in the same transaction. Bulk cancel or move previews first, skips bookings that cannot change, and audits each change.

## BR-DEAD: Deadlines (Rule 6)

- **BR-DEAD-1** Cancellation closes `cancellationCutoffMinutes` (_policy_, default **60**) before the start of the booked slot. For Breakfast that is the window start (6:00 AM for a 7:00 AM start). (ADR-0010)
- **BR-DEAD-2** Changing slot closes at the start of the currently booked slot (Spec §4.5).
- **BR-DEAD-3** Changing Veg/Non-Veg closes `dietTypeChangeCutoffMinutes` (_policy_, default **60**) before slot start (ADR-0012).
- **BR-DEAD-4** A deadline is passed when `now >= deadline`. At exactly the deadline the action is refused (`BOOKING_DEADLINE_PASSED`).
- **BR-DEAD-5** Booking a new meal for today is allowed until the chosen slot's start, subject to capacity.
- **BR-DEAD-6** "Cancel Today's Meals" cancels only the meals still before their deadline and reports the rest as not eligible (Spec §4.4).
- **BR-DEAD-7** Staff overrides may bypass deadlines only with a mandatory reason (`OVERRIDE_REASON_REQUIRED`); the override is flagged in the audit log (Admin §H).

## BR-CAP: Capacity and availability (Rule 7, Spec §5)

- **BR-CAP-1** Official capacity for slot/date = the per-date override if one exists, else the weekday default, else the slot default.
- **BR-CAP-2** `bookedCount` counts `BOOKED` bookings for the slot/date (plus `COMPLETED`/`NO_SHOW` for past dates). It is checked inside the booking transaction under an advisory lock on (slot, date) (ADR-0004).
- **BR-CAP-3** `overCapacityCount = max(0, bookedCount - officialCapacity)`; `occupancyPct = min(100, bookedCount / officialCapacity × 100)`.
- **BR-CAP-4** If `allowOverCapacityBooking` (_policy_, default **false**, ADR-0005) is false, a slot at capacity is disabled (`SLOT_UNAVAILABLE`). If true, the booking is accepted, flagged `is_over_capacity`, and the UI shows "Official capacity reached — additional bookings are being accepted under the mess policy" (Spec §5.2).
- **BR-CAP-5 Availability labels** (ADR-0013), first match wins:
  1. `OVER_CAPACITY` if `overCapacityCount > 0`
  2. `FULL` if `bookedCount >= officialCapacity`
  3. `FILLING_FAST` if `occupancyPct >= fillingFastThresholdPct` (_policy_, default **80**)
  4. otherwise `AVAILABLE`

  Additionally, `RECOMMENDED` marks the active slot with the lowest occupancy for that meal/date, provided it is ≤ `recommendedMaxOccupancyPct` (_policy_, default **60**). Ties go to the earlier slot. It never changes the student's choice (Spec §5.1).

- **BR-CAP-7 Slot Selection** (Phase 3, ADR-0020): seats in use are `BOOKED`, `COMPLETED` and `NO_SHOW` bookings. A slot can be chosen unless the meal is closed that day, the slot has already started (today only, BR-DEAD-5), or it is at capacity while `allowOverCapacityBooking` is off. `RECOMMENDED` is given only to a choosable, not-full slot when at least two exist. Occupancy % is rounded down for display. Dates outside today … today + `bookingHorizonDays` (inclusive) return `BOOKING_NOT_ALLOWED`.
- **BR-CAP-6** Lowering a capacity below current bookings is allowed after the admin sees a warning with impact counts. Existing bookings are kept and become over-capacity (Admin §D).

## BR-DEF: Default Booking generation and full-slot fallback

- **BR-DEF-1** The nightly `generate-default-bookings` job materializes bookings for today+1 … today+`bookingHorizonDays` via `resolveEffectiveBooking`. It skips closures, leave, existing date exceptions and auto-disabled meals. It is idempotent.
- **BR-DEF-2** If the preferred slot is full and over-capacity booking is off, `defaultSlotFullFallback` (_policy_, default **`ASK_STUDENT`**, ADR-0006) applies:
  - `ASK_STUDENT`: no booking is created; the student is notified to pick a slot.
  - `AUTO_NEXT_AVAILABLE`: the next later active slot with space is booked (wrapping to earlier slots if none), and the student is notified of the change. Their preference is not changed.
- **BR-DEF-3** Turning the overall switch off cancels future `DEFAULT`-source bookings that are still before their cancellation deadline and keeps saved preferences. Turning it on regenerates them.
- **BR-DEF-4** Saving preferences (overall switch, one meal, or all meals) and finishing first-time setup reconcile the student's upcoming days immediately, in the same transaction. Only bookings owned by the recurring rule are created, moved or cancelled; one-day changes by the student and staff overrides are kept. The response lists what changed (Spec §8.3) and how many bookings were updated. (ADR-0023)
- **BR-DEF-5** The nightly job runs at 00:30 IST in the worker process, one `job_runs` row per business date; finished runs are skipped, a run stuck in RUNNING for over an hour is retried, and a missed day runs when the worker starts. (ADR-0023)
- **BR-DEF-6** A recurring booking cancelled by the system is labelled "Not Booked — Default Off". A meal auto-disabled by the no-show engine (BR-NS-5) cannot be switched back on by the student; staff or an approved appeal do that.

## BR-PLAN: Plan Ahead (Spec §6)

- **BR-PLAN-1** A one-date change from Plan Ahead is the same one-day exception as a change from Home: it affects only that date and never changes Default Booking or weekday rules. Dates are limited to today … today + `bookingHorizonDays`.
- **BR-PLAN-2** A weekday rule sets the slot and meal type for one meal on chosen weekdays (IST). Two active rules for the same meal may not share a weekday. One save may cover several meals; each meal becomes its own rule. (ADR-0014, ADR-0024)
- **BR-PLAN-3** Creating, editing or deleting a rule updates the student's upcoming bookings at once; only bookings owned by the recurring rules move. Edits and deletes need the version shown. Deleted rules are kept inactive for history.
- **BR-PLAN-4** The overall Default Booking switch and a no-show auto-disable pause weekday rules; a meal's own switch does not. Paused rules are kept and shown as paused. (ADR-0024)

## BR-LEAVE: Leave (Rule 9, Spec §11)

- **BR-LEAVE-1** A leave covers the inclusive meal range from (startDate, startMeal) to (endDate, endMeal) in Breakfast→Lunch→Dinner order. Example: 22–31 May, Breakfast→Dinner = 10 days / 30 meals.
- **BR-LEAVE-2** End cannot precede start (`LEAVE_RANGE_INVALID`). Leaves of the same student may not overlap.
- **BR-LEAVE-3** If `leaveRequiresApproval` (_policy_, default **false**, ADR-0007) is false, a new leave is `APPROVED` immediately. If true it is `PENDING`, and meals are not paused until a staff member approves it.
- **BR-LEAVE-4** On approval, bookings in range become `PAUSED_LEAVE`, and no bookings or No-shows are created for covered meals.
- **BR-LEAVE-5** Upcoming / On Leave / Not on Leave are derived from dates and `now`; only `PENDING/APPROVED/REJECTED/CANCELLED` are stored.
- **BR-LEAVE-6** Extend: the new end must be later than the current end, and the range is re-validated.
- **BR-LEAVE-7** End early: the resume point is the first meal to book again. The earliest allowed resume point is the first meal whose cancellation deadline has not passed. Meals from the resume point onward are re-resolved, so Default Booking resumes.
- **BR-LEAVE-8** Leave meals already in the past at approval time are not changed retroactively. Meals whose slot has started are never paused or resumed.
- **BR-LEAVE-9** A student's leave may start, and a student may resume, only at a meal whose cut-off has not passed: the cancellation deadline of the booked slot, or the meal's start when nothing is booked. Staff may use any meal that has not started. (ADR-0026)
- **BR-LEAVE-10** When approval is required, extending an approved leave sends the extra days as a separate pending request. Staff-created leaves are approved at once. Create, end and correct by staff need a reason, are audited as overrides, and notify the student; approve and reject notify the student too (Admin §K).
- **BR-LEAVE-11** After every leave change, uncovered paused meals are restored through the resolver with the full-slot fallback; if nothing wants them booked they are cancelled by the system, and if the slot is full the student is told to pick another slot. (ADR-0026)

## BR-NS: No-shows (Rule 10, Spec §10)

- **BR-NS-1** A No-show is recorded only after the attendance window closes (service end + per-meal grace, default 0) for a `BOOKED` booking without a valid attendance record.
- **BR-NS-2** On-time cancellations, leave meals, closures and approved appeals never count.
- **BR-NS-3** Counts are per meal type over a rolling `noShowWindowDays` (_policy_, default **30**) ending today, counting only events with status `COUNTED`.
- **BR-NS-4** At `noShowWarningThreshold` (_policy_, default **3**), show a dismissible warning naming the meal and how many more No-shows would disable it. At 4, the warning stays.
- **BR-NS-5** At `noShowDisableThreshold` (_policy_, default **5**), Default Booking is auto-disabled for that meal only. Preferences are preserved, manual booking is still allowed, and the student is told why. (ADR-0009)
- **BR-NS-6** Re-enable after auto-disable: Default Booking stays off. The student may switch it back on once their rolling count is below the disable threshold. Staff may re-enable at any time with a reason. If the event that caused the disable is overturned by an approved appeal and the count drops below the threshold, the disable is lifted automatically.
- **BR-NS-7** If outage mode was active during the meal window, missing-attendance events are created as `HELD_FOR_REVIEW` and do not count until staff confirm them (Admin §I).
- **BR-NS-8** Staff reset marks the student's counted events for that meal as `EXCLUDED/STAFF_RESET` with a mandatory reason.

## BR-ATT: Attendance

- **BR-ATT-1** Attendance sources are `FACE_VERIFICATION`, `MANUAL_FALLBACK` and `IMPORT`. `verified_at` is set only from the face-verification provider and is never fabricated (Spec §7).
- **BR-ATT-2** Manual marking is allowed only during, or shortly after, the active meal window, and only for a student with a booking (or with an override reason). "Shortly after" is the meal's grace period: marking is open from service start until service end + grace. Cancelled, leave and closed meals cannot be marked. (ADR-0025)
- **BR-ATT-3** One attendance record per student and meal. Recording it (any source) turns a Booked meal into Meal Completed at once. Manual marks use `MANUAL_FALLBACK` and are audited; during outage mode they are linked to the outage window.
- **BR-ATT-4** When a window closes, the worker pulls face verifications, then turns each remaining Booked meal into Meal Completed (attendance found) or No-show (BR-NS-1, BR-NS-7). It runs every 5 minutes, once per date and meal, and catches up on the previous two days.
- **BR-ATT-5** An attendance import covers one meal window and is previewed before it is applied. It records `IMPORT` attendance only for Booked meals and for No-shows held during an outage (those events become `EXCLUDED`, `OUTAGE_REVIEW_DISMISSED`). Counted No-shows go to No-show review. (ADR-0025)
- **BR-ATT-6** My Bookings (Spec §7) lists final records: Meal Completed, Cancelled (by the student or staff), Mess closed and No-show. A recurring meal the system cancelled because Default Booking was turned off is not shown. A verification time is shown only for face verification.

## BR-CLOS: Closures (Admin §F)

- **BR-CLOS-1** Applying a closure marks affected `BOOKED` bookings `CANCELLED_BY_CLOSURE`, notifies the students and blocks No-shows for those meals.
- **BR-CLOS-2** Removing a closure re-runs the resolver for affected student/meals. Bookings are restored to `BOOKED` where intent still resolves to a booking and capacity allows; otherwise the student is notified to rebook. Only slots that have not started are restored; a full slot follows BR-DEF-2. (ADR-0017, ADR-0023)
- **BR-CLOS-3** One active closure per meal and date; closures cannot be set for past dates. Applying and removing each need a reason and write one audit entry in the same transaction. The admin sees how many bookings will be cancelled before confirming.
- **BR-CLOS-4** Special-meal days are not closures: they use the menu's special flag and per-date capacity overrides.

## BR-CMP: Complaints (Rule 12, Spec §12)

- **BR-CMP-1** Visible only to the submitter and staff with `complaints:read`. Internal notes are never returned by the student API.
- **BR-CMP-2** `complaintPrivacyMode` (_policy_, default **`PRIVATE_IDENTIFIED`**, ADR-0008). Under `ANONYMOUS`, no student ID or hostel is stored. The submitter can see status through a device-held receipt token but gets no push or in-app status notifications. The mode is snapshotted per complaint.
- **BR-CMP-3** Photos: JPEG/PNG/HEIC/WebP, max 5 MB each, max 3 per complaint, type checked by content, not extension.
- **BR-CMP-4** Status flow: `NEW → IN_REVIEW → RESOLVED | REJECTED`. Each change is recorded in history and notifies an identified submitter.

## BR-AUTH: Authentication (Rule 11, Admin §B)

- **BR-AUTH-1** Student registration requires a reference number present and active in `college_roster`. Reference numbers are normalized to digits only before comparison.
- **BR-AUTH-2** Passwords are hashed with argon2id. Hashes never appear in logs or responses.
- **BR-AUTH-3** Password policy: students min 8 chars; staff min 12 chars and not equal to their email. Lockout after 5 consecutive failures for 15 minutes (students and staff). Login is also rate-limited per IP. Every failure counts, including parallel attempts (compare-and-swap on the counter). For staff with 2FA, a correct password does not reset the counter; only a correct code does.
- **BR-AUTH-4** Refresh tokens rotate on every use. Reuse of a rotated token revokes the whole session family. Access tokens carry their session id and stop working as soon as that session is revoked (logout, log out everywhere, password change or reset), not when they expire (ADR-0021).
- **BR-AUTH-5** Staff must change their password on first login. TOTP 2FA is optional per staff member.
- **BR-AUTH-6** Credential reset (no email/SMS assumed): staff issue a one-time code, shown once and valid 24 h, which the student enters with their reference number to set a new password. (ADR-0019) The code is 10 characters without look-alike letters/digits, stored only as a hash, allows 5 wrong attempts, and issuing a new code voids the previous one. A successful reset signs the student out everywhere. Wrong, expired and used codes all return the same error. Each guess is counted before the code is checked, so parallel guesses cannot exceed 5.
- **BR-AUTH-7** College-controlled profile fields (_policy_ `collegeControlledFields`, default reference number, full name, department, academic year) are read-only for students. Hostel/block, room, phones, email and photo are editable. (ADR-0018)

- **BR-AUTH-8** Login, registration, roster check and refresh are rate-limited per client IP (10, 10, 20 and 30 requests per minute). If Redis is unavailable the limiter allows the request, and account lockout (BR-AUTH-3) still applies.
- **BR-AUTH-9** Login errors never reveal whether an account exists: unknown numbers and wrong passwords return the same message, with similar response times. Deactivated, staff-locked or disabled status is shown only after the correct password (ADR-0021).
- **BR-AUTH-10** A locked or deactivated student cannot log in or refresh; refreshing such an account revokes its sessions.

## BR-ONB: First-time setup (Spec §3 Screens 5–8)

- **BR-ONB-1** Registration copies name, department, academic year, hostel block, room and email from the roster entry (Screen 5 prefill).
- **BR-ONB-2** Required at Screen 8: hostel block (an active one), room number, student phone and parent phone. Email and photo are optional. Phone numbers are stored as 7–15 digits with an optional leading `+`.
- **BR-ONB-3** "Save & Continue" saves profile changes, all three meal preferences and the overall Default Booking switch in one transaction, then marks onboarding complete. College-controlled values in the request are ignored (BR-AUTH-7).
- **BR-ONB-4** An enabled Lunch or Dinner preference needs an active slot of that meal. Breakfast's single window is filled in automatically, also while Breakfast is off, so switching it on later needs no slot choice.
- **BR-ONB-5** Every meal starts OFF in the setup screen. Nothing is booked until the student switches a meal on.
- **BR-ONB-6** Finishing setup creates the upcoming Default Bookings from these preferences at once (BR-DEF-4).
- **BR-ONB-7** Profile photos: JPEG, PNG, WebP or HEIC detected from file content, ≤5 MB, served only through signed URLs that expire after 15 minutes.

## BR-IDEM: Idempotency (Rule 13)

- **BR-IDEM-1** Booking, cancellation, leave and complaint submissions accept an `Idempotency-Key`. A replay within 24 h returns the original response. A replay with a different payload returns `IDEMPOTENCY_KEY_REUSED`. (ADR-0016)

## BR-ADM: Admin mutations (Admin §P, working rule 7)

- **BR-ADM-1** Every admin mutation checks a permission, writes exactly one audit entry in the same transaction, and requires a reason when it overrides a student rule.
- **BR-ADM-2** Edited records carry `version`. A stale version returns `VERSION_CONFLICT`.

## BR-FC: Forecasting (Admin §N)

- **BR-FC-1** Expected plates = booked count × show-up rate. The show-up rate is the rolling average of attended ÷ booked for that meal over the last `forecastLookbackDays` (default **14**) days with data. With fewer than 7 days of history, the forecast is flagged low-confidence and falls back to the available days, or to 1.0 when there are none.
- **BR-FC-2** "Days with data" are past days with at least one attendance record or no-show for the meal, so a missing attendance feed never reads as 0% show-up. The rate is rounded to 4 decimals; expected plates are rounded up. Used by the admin dashboard now and the kitchen forecast in Phase 11 (`modules/forecasting/domain/show-up-rate.ts`).
