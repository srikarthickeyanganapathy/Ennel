# ADR-0027: No-show engine, appeals and staff review

- Status: Accepted (default), pending institutional approval
- Date: 2026-11-01

## Context

Spec §10 and ADR-0009 set the window (30 days), the warning (3) and the disable (5), and BR-NS-7 holds No-shows during an outage. Admin §J describes appeals, resets and re-enable. Still open: when the engine runs, what an approved appeal changes, how often students are notified, and what a reset does to an auto-disable.

## Decision

- **When it runs:** the engine evaluates a student's meal right after a counted No-show is created (window closing) or confirmed (outage review), in the same transaction. A per-student advisory lock means the disable is decided once.
- **Rolling window:** events whose meal date is in the last `noShowWindowDays` days including today, with status `COUNTED`.
- **Auto-disable:** at the disable threshold, `meal_preferences.auto_disabled_at` and `auto_disabled_by_event_id` are set. Upcoming default and weekday-rule bookings for that meal are re-synced (cancelled where still allowed). The student's own choices are kept.
- **Notifications:** one when a meal first reaches the warning level, one when it is disabled, one when an appeal brings it back, and one for each appeal decision. Each is sent once (dedupe by cause).
- **Home warning:** dismissible at the warning threshold for the current visit, and staying from the next No-show on (BR-NS-4).
- **Appeals ("report incorrect record"):** one report per event, for counted or held events in the window. Approval excludes the event (`APPEAL_APPROVED`); the booking stays a No-show in history, because no attendance is invented. If the count is then below the threshold, the auto-disable lifts automatically (ADR-0009). Rejection needs a reason, which the student sees.
- **Outage review:** held events are confirmed (they then count and are evaluated) or dismissed (`OUTAGE_REVIEW_DISMISSED`); both need a reason.
- **Reset and re-enable:** a reset excludes the counted events of one meal in the window (`STAFF_RESET`) but does not switch Default Booking back on. Staff re-enable is a separate action, or the student can switch it back on once the count is below the threshold. Both staff actions are audited as overrides.

## Consequences

The institution should approve the thresholds and the appeal process before launch (Spec §10). Window closing only catches up two days, so meals from a longer worker outage stay Booked and never become No-shows; this is deliberate for now, so students are not penalised for a system outage. Tests: `apps/api/test/integration/no-shows.int.spec.ts`, `no-show-rules.spec.ts`.
