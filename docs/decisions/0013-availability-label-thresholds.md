# ADR-0013: Availability label thresholds

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §5.1 defines the labels Available, Filling Fast, Full, Recommended and Over Capacity, "based on live booking counts and configured thresholds". Spec §18.3 leaves the values open.

## Decision

- `filling_fast_threshold_pct` = **80**, `recommended_max_occupancy_pct` = **60** (both in `mess_policy`, editable with `mess-config:update`, because Admin §D lists thresholds under configuration).
- Primary label, first match wins: `OVER_CAPACITY` (accepted > capacity) → `FULL` (accepted ≥ capacity) → `FILLING_FAST` (occupancy ≥ 80%) → `AVAILABLE`.
- `RECOMMENDED` is an extra flag on the single least-occupied active slot of the meal/date, if its occupancy is ≤ 60%. Ties go to the earliest slot. It never changes the student's selection.
- Validation: `0 < recommended < fillingFast < 100`.

## Consequences

The labels come from one pure function (`computeAvailability`) used by the student and admin APIs. Clients show text plus colour.

Note: thresholds sit in `mess_policy` for one change history, but are editable with `mess-config:update`. That is the only policy field not gated by `policy:update`.
