# ADR-0017: Removing a closure restores eligibility through the resolver

- Status: Accepted (default), pending institutional confirmation
- Date: 2026-10-19

## Context

Admin §F: deleting a closure "restores eligibility according to the resolution order (document behaviour)".

## Decision

- Closures are never hard-deleted. Removal sets `status = REMOVED`, `removed_by_id` and `removed_at`, with a reason, inside one audited transaction.
- For each affected student/meal with a `CANCELLED_BY_CLOSURE` booking on a date not yet past its slot start, re-run `resolveEffectiveBooking` without the closure:
  - It resolves to a booking and capacity allows → set the booking back to `BOOKED` (keeping its source), log `RESTORED_AFTER_CLOSURE`, notify "Mess reopened, your booking is restored".
  - It resolves to a booking but the slot is full → apply `defaultSlotFullFallback` (ADR-0006).
  - It resolves to no booking → leave it `CANCELLED_BY_CLOSURE` and send a "Mess reopened, you can book" notice.
- Meals whose slot has already started are not restored.

## Consequences

Restoration is deterministic and reuses the same rules as generation. Large closures run as a background job with progress shown in the admin app.
