# ADR-0010: Policy `cancellationCutoffMinutes` and change-slot deadline

- Status: Accepted
- Date: 2026-10-19

## Context

Spec §4.5: cancellation closes one hour before the meal/slot begins; changing slot closes at the start of the currently booked slot.

## Decision

- `mess_policy.cancellation_cutoff_minutes`, default **60**. Deadline = slot start − cutoff. For Breakfast the slot is the whole serving window.
- The change-slot deadline is the start of the currently booked slot. It is not configurable because the spec fixes it.
- `now >= deadline` means closed.
- The server is the only authority. Responses include `cancellationDeadlineAt` and `changeSlotDeadlineAt` so clients can render countdowns.

## Consequences

Changing the cutoff applies to all future deadlines immediately, and the change is recorded in policy history.
