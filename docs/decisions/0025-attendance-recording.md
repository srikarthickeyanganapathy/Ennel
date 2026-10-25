# ADR-0025: Attendance recording, window closing and imports

- Status: Accepted (default), pending confirmation with mess management and the college IT team
- Date: 2026-10-25

## Context

Admin §I and BR-ATT-1/2 describe face verification, manual marking at the counter, outage mode and attendance import, and BR-NS-1/7 say when a No-show is recorded. Not settled: how the app talks to the college's face-verification system (no API details yet), when a booking becomes "Meal Completed", what "shortly after the meal window" means for manual marks, and what an import may change once a window has closed.

## Decision

- **Provider port:** attendance from face verification comes through an `AttendanceProvider` port. The default adapter reports "not configured" and returns nothing, so the app never invents a verification. The real adapter is written once the college shares its API.
- **One writer:** manual marks, imports and provider data all go through `AttendanceRecorder`. Each student has at most one attendance record per meal, and recording it turns a Booked meal into Meal Completed at once. `verified_at` is stored only for `FACE_VERIFICATION`.
- **Manual marking window:** staff may mark a student present from service start until the attendance window closes (service end + the meal's grace minutes). A Booked meal needs no reason; a student without a booking needs a reason (audited as an override). Cancelled, leave and closed meals cannot be marked. After the window, corrections belong to No-show review (Phase 9). Manual marks always use `MANUAL_FALLBACK`; during outage mode they are linked to the outage window.
- **Window closing:** the worker's `close-attendance-window` job runs every 5 minutes for every closed window of today and the two days before, once per `date:meal` (`job_runs`). It first pulls provider verifications, then marks each remaining Booked meal Completed (attendance found) or No-show with a no-show event: `COUNTED`, or `HELD_FOR_REVIEW` when outage mode overlapped the window (BR-NS-7). Thresholds, warnings and auto-disable come with the no-show engine (Phase 9).
- **Import:** one CSV/XLSX file per meal window with a `reference_number` column, previewed before it is applied. A row is applied only when the meal is still Booked, or when it is a No-show held during an outage (the held event becomes `EXCLUDED` with `OUTAGE_REVIEW_DISMISSED`). Counted No-shows, students without a booking and repeated rows are skipped with a reason. Imported records carry no verification time.
- **Status labels:** attendance does not change the "Updated by mess staff" marker, because recording attendance is not a booking override.

## Consequences

Until the provider adapter exists, attendance depends on manual marking and imports. The college IT team must provide the face-verification API (endpoint, authentication, data per verification). Mess management should confirm the manual-marking window and whether walk-ins without a booking should be allowed at all. Tests: `apps/api/test/integration/attendance.int.spec.ts`, `attendance.spec.ts`, `attendance-import.spec.ts`.
