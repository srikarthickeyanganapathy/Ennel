# ADR-0020: Slot availability details

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-21

## Context

Spec §5 and ADR-0013 define the availability labels, but leave some details open for the Slot Selection screen (Phase 3):

1. Which bookings count as seats in use.
2. Whether "today + horizon" includes the last day.
3. Which slots can carry the Recommended flag.
4. How occupancy is rounded for display.

## Decision

- **Seats in use** = bookings with status `BOOKED`, `COMPLETED` or `NO_SHOW` for that slot and date. Cancelled, paused-for-leave and closure-cancelled bookings free the seat.
- **Horizon** is inclusive: with `bookingHorizonDays = 7`, a student on 21 Oct can view and book up to 28 Oct. Dates outside the range return `BOOKING_NOT_ALLOWED` with `details.lastBookableDate`.
- **Choosable slot:** not covered by an active closure, not yet started when the date is today (BR-DEAD-5), and below official capacity unless `allowOverCapacityBooking` is on.
- **Recommended** is given only to a choosable slot that is not full, and only when at least two such slots exist. Breakfast's single window is therefore never "recommended", and a slot that has already started is never suggested.
- **Occupancy %** is rounded down, so a slot shows 100% only when it is actually full. Labels use the exact ratio, not the rounded number.
- A slot with **official capacity 0** is treated as full.

## Consequences

The rules live in `computeSlotAvailability` (`apps/api/src/modules/slots/domain/slot-availability.ts`), which the Phase 4 booking engine and admin dashboard will reuse. The student app shows the API's result and never computes availability itself (Spec §14).
