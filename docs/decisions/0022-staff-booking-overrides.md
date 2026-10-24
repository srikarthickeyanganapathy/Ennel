# ADR-0022: Staff booking overrides

- Status: Accepted (default), pending confirmation with mess management
- Date: 2026-10-24

## Context

Admin §H lets staff create, cancel, move and correct bookings, bypassing student deadlines with a mandatory reason. It does not say whether staff may exceed capacity, which statuses may be corrected, how bulk changes are audited, or what the Home label shows before the nightly Default Booking job exists.

## Decision

- **Deadlines:** staff overrides ignore student deadlines and the booking period (BR-DEAD-7). They still respect closures and approved leave.
- **Capacity:** staff overrides follow the same capacity rule as students (BR-CAP-4): a full slot is refused unless `allowOverCapacityBooking` is on. Exception: correcting a booking to Meal Completed records a meal that happened, so it is not capped.
- **Status corrections:** staff may set Booked, Cancelled or Meal Completed, from Booked, Cancelled or Meal Completed. Paused (leave), Mess closed and No-show belong to the leave, closure and no-show processes; No-show corrections come with no-show review (Phase 9), because they change the student's rolling count.
- **Concurrency:** single overrides send the version shown in the grid; a newer change returns `VERSION_CONFLICT`. Bulk actions re-check each booking when applied.
- **Bulk audit:** one audit entry per changed booking (`booking.bulk.cancel` / `booking.bulk.move`), each flagged as an override with the shared reason. Bookings that cannot be changed (e.g. the target slot is full) are skipped and listed, not failed as a batch.
- **What the student sees:** every override writes the one-day date exception with origin `ADMIN`, sets `lastActorType = STAFF`, and adds a booking event with the staff member and reason. The meal card shows "Updated by mess staff".
- **Home before Phase 5:** a meal whose Default Booking is on but has no booking yet shows "Not Booked" (not "Not Booked — Default Off"). The nightly job that creates Default Booking rows arrives in Phase 5.

## Consequences

Mess management should confirm whether staff may exceed capacity; if so, it becomes a policy flag. Tests: `test/integration/admin-bookings.int.spec.ts`.
