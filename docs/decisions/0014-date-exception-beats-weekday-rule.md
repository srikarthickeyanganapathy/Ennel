# ADR-0014: Date exception beats weekday rule

- Status: Accepted, pending institutional confirmation
- Date: 2026-10-19

## Context

Spec §6.2 recommends that a date-specific choice wins over a recurring weekday rule, and that the app shows which rule is applied. Spec §18.9 lists it as open. Rule 4 fixes the full order.

## Decision

`resolveEffectiveBooking` order: **closure > approved leave > date exception > weekday rule > Default Booking**. The result includes `appliedRule` (`CLOSURE | LEAVE | DATE_EXCEPTION | WEEKDAY_RULE | DEFAULT | NONE`), which the Home card uses to explain itself ("Changed for This Day", "Weekday rule: Mon, Wed, Fri").

If two active weekday rules for the same meal share a weekday, the API rejects saving the second one (`VALIDATION_FAILED`) instead of picking one silently.

## Consequences

Exhaustive unit tests cover every combination of the five inputs.
