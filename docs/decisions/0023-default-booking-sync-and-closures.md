# ADR-0023: Default Booking sync, the nightly job and closure details

- Status: Accepted (default), pending confirmation with mess management
- Date: 2026-10-24

## Context

Spec §8 and BR-DEF-1 describe a nightly job that creates Default Bookings. They do not say what happens between a preference change and the next night, when the job runs, how a booking the system cancelled is labelled, or which closure details matter for students (Admin §F).

## Decision

- **Immediate sync:** saving Default Booking preferences (PUT or PATCH) and finishing first-time setup reconcile that student's upcoming days at once (today … today + `bookingHorizonDays`), in the same transaction. Students do not wait for the night to see the change on Home.
- **What reconciliation touches:** only bookings owned by the recurring rule (source `DEFAULT` or `PLAN_AHEAD_WEEKDAY`, either booked or cancelled by the system). A meal the student booked, changed or cancelled themself, and every staff override, is left alone. Nothing past its deadline is changed.
- **Nightly job:** `generate-default-bookings` runs at **00:30 IST** in the BullMQ worker (`pnpm dev:worker`), for today + 1 … today + horizon. It is recorded in `job_runs` per business date: a finished run is skipped, a run still marked RUNNING after one hour is retried, and the worker runs a missed day when it starts. Each student is processed in their own transaction, so one failure does not undo the others.
- **System-cancelled label:** a recurring booking the system cancelled (the student turned the meal or Default Booking off) shows "Not Booked — Default Off", the same as a day that was never booked.
- **Full slot:** BR-DEF-2 applies during sync and the job. Notifications use one dedupe key per date and meal, so a student is told once.
- **Closures:** a closure covers one date and one or more meals; only one active closure per meal and date. It cannot be set for past dates. Applying it and removing it each need a reason and write one audit entry. Removal is a `POST …/remove` (not `DELETE`), because the closure row stays for history with who removed it and why.
- **Closure removal (ADR-0017):** only bookings whose slot has not started are restored. If the usual slot is now full, `AUTO_NEXT_AVAILABLE` books the next open slot; `ASK_STUDENT` leaves the meal unbooked and tells the student to pick another slot.
- **Special-meal days** are not closures: they use the special flag on the menu (Admin §E) and per-date capacity overrides (Admin §D). The Closures page links to both.

## Consequences

The worker is a separate process that must run in production; without it, only immediate sync creates bookings and the horizon is not extended each night. Mess management should confirm the 00:30 IST run time. Tests: `test/integration/default-booking.int.spec.ts`, `test/integration/admin-closures.int.spec.ts`.
