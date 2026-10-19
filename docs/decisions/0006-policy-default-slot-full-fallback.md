# ADR-0006: Policy `defaultSlotFullFallback`

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §8.4: a mockup suggests auto-assigning the next available slot when the preferred default slot is full. The spec requires an explicit rule and recommends not changing slots silently. Spec §18.5 lists it as open.

## Decision

- `mess_policy.default_slot_full_fallback` ∈ `ASK_STUDENT | AUTO_NEXT_AVAILABLE`, default **`ASK_STUDENT`**.
- `ASK_STUDENT`: the generation job creates no booking for that meal/date and sends a notification asking the student to choose a slot.
- `AUTO_NEXT_AVAILABLE`: the job books the next later active slot with space, falling back to earlier slots. It notifies the student with the assigned slot and never changes the saved preference.
- This only applies when over-capacity booking is off or would not be used.

## Consequences

The Default Booking page must state which behaviour is active (the policy is exposed read-only to students).
