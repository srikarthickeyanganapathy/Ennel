# ADR-0009: No-show window, thresholds and re-enable behaviour

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §10: five No-shows per meal in a rolling 30 days disables Default Booking for that meal, with a warning at three. Spec §18.7 asks for approval of the policy and the appeal process. The spec does not say how Default Booking comes back after an auto-disable.

## Decision

- `no_show_window_days` = **30**, `no_show_warning_threshold` = **3**, `no_show_disable_threshold` = **5**, counted per meal type over events with status `COUNTED`.
- Auto-disable sets `meal_preferences.auto_disabled_at` and `auto_disabled_by_event_id`. The student's own `is_enabled`, slot and diet are preserved.
- Re-enable:
  - The student may turn it back on once their rolling count for that meal is below the disable threshold.
  - Staff with `no-shows:reset` may re-enable at any time, with a reason.
  - If an approved appeal brings the count below the threshold, the auto-disable is cleared automatically.
- Validation: `0 < warning < disable`, window between 7 and 90 days.

## Consequences

The disable lifts as old events age out, but it is not silent: the student re-enables it themselves.
