# ADR-0004: Capacity enforcement with advisory transaction locks

- Status: Accepted
- Date: 2026-10-19

## Context

Rule 7 requires per-slot, per-date counting with no overbooking under concurrency (the last-seat race). The alternatives were a counter table updated with `SELECT … FOR UPDATE`, or locking plus counting the booking rows directly.

## Decision

Inside the booking transaction:

1. `SELECT pg_advisory_xact_lock(hashtextextended('slot:' || slot_id || ':' || meal_date, 0))`
2. `COUNT(*)` of bookings for (slot, date, status = BOOKED), served by the index `(meal_date, meal_id, slot_id, status)`.
3. Apply the capacity rule (BR-CAP-4) and insert/update.

The lock is released at commit. A move between slots locks both slots in a fixed order (by slot id) to avoid deadlocks.

## Consequences

- No counter can drift, because there is no counter.
- Raw SQL for the lock lives in the bookings repository only.
- An integration test fires N concurrent requests at a slot with one seat left and asserts exactly one success.
