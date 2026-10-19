# ADR-0007: Policy `leaveRequiresApproval`

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §11.1 says the app must show whether a leave is immediately active or pending approval. Spec §18.6 lists it as open.

## Decision

- `mess_policy.leave_requires_approval`, default **false**.
- false: a new or extended leave is `APPROVED` on submit and bookings are paused immediately.
- true: the leave is `PENDING`, bookings are untouched until a staff member with `leaves:approve` approves it, and rejection requires a reason. Both outcomes notify the student.
- Changing the flag affects new requests only. Existing `PENDING` leaves stay in the queue.

## Consequences

The approval queue in the admin app appears only when the flag is on, or while pending items remain.
