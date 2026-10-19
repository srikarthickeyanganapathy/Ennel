# ADR-0005: Policy `allowOverCapacityBooking`

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §5.2 describes accepting bookings beyond official capacity because some students won't attend, but says the institution must explicitly approve it. Spec §18.2 lists it as open.

## Decision

- `mess_policy.allow_over_capacity_booking`, default **false**.
- false: a slot at official capacity is labelled `FULL` and disabled; booking returns `SLOT_UNAVAILABLE`.
- true: the booking is accepted and flagged `is_over_capacity`. The slot is labelled `OVER_CAPACITY` once over, with the message "Official capacity reached — additional bookings are being accepted under the mess policy". Accepted count and official capacity are shown separately (e.g. 507 accepted / 500 capacity, +7).

## Consequences

The safe default avoids crowding until approved. Switching it on needs `policy:update` and a reason, and is recorded in `mess_policy_history`.
