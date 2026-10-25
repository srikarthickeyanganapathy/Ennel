# ADR-0024: Plan Ahead weekday rules

- Status: Accepted (default), pending confirmation with mess management
- Date: 2026-10-25

## Context

Spec §6.2 lets a student repeat a different slot and meal type on chosen weekdays. ADR-0014 already settles that a one-day change beats a weekday rule. Still open: whether a weekday rule books when Default Booking is OFF, how a rule covering several meals is stored, and what deleting a rule does. Spec §8.1 says the overall switch "pauses automatic booking for all meals".

## Decision

- **Pausing:** the overall Default Booking switch and a no-show auto-disable (BR-NS-5) pause weekday rules too, because both stop automatic booking. A meal's own ON/OFF switch does not pause them: a rule is an explicit choice for those days. A paused rule is kept and shown with the reason (`pausedReason`: `DEFAULT_BOOKING_OFF` or `AUTO_DISABLED`).
- **Several meals:** "Choose a Day" can cover more than one meal; each meal gets its own rule with its own slot and meal type, created together in one transaction. Edit and Delete work on one rule.
- **Overlap:** two active rules for the same meal may not share a weekday (ADR-0014); the save is refused with the clashing days named.
- **Concurrency:** edits and deletes send the version shown; a newer change returns `VERSION_CONFLICT`. Rule changes for one student are serialised with an advisory lock so two saves cannot both pass the overlap check.
- **Delete:** the rule row is kept as inactive (history), and the days go back to Default Booking.
- **Bookings:** every rule change re-syncs the student's booking period at once (BR-DEF-4 reconciler). Only recurring-owned bookings move; one-day changes and staff overrides stay.
- **One-date changes from Plan Ahead** use the same booking commands as Home and are stored as one-day exceptions with origin `MANUAL`. The `PLAN_AHEAD_DATE` origin stays reserved; it can be added if reports need to tell Home and Plan Ahead apart.

## Consequences

Mess management should confirm that the overall switch pausing weekday rules matches students' expectations. Tests: `apps/api/test/integration/weekday-rules.int.spec.ts`, `resolve-effective-booking.spec.ts`, `weekday-rule-checks.spec.ts`.
