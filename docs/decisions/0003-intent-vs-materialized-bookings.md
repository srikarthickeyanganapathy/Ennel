# ADR-0003: Booking intent tables vs. materialized bookings

- Status: Accepted
- Date: 2026-10-19

## Context

Spec §15 and Rule 5 require Default Booking, one-day changes and weekday exceptions to stay separate and never overwrite each other. Capacity counts, attendance and no-shows need a concrete record per meal.

## Decision

- Intent is stored in three tables: `meal_preferences` (per student/meal), `weekday_rules`, and `date_exceptions` (unique per student/date/meal, action `BOOK` with slot/diet or `SKIP`).
- `bookings` holds at most one row per student/date/meal with the resolved current state. `booking_events` records every transition.
- `resolveEffectiveBooking({ closure, leave, dateException, weekdayRule, preference, policy })` is a pure function returning `NONE | BOOK(slot, diet, source) | PAUSED_LEAVE | CLOSED`, plus which rule applied.
- Student actions on a specific date (book, change, cancel) write the `date_exception` and update the booking in one transaction. A cancellation is a `SKIP` exception, so the nightly job never re-creates it.
- Jobs and admin "regenerate" use the resolver to materialize future bookings.

## Consequences

- A manual booking cannot flip Default Booking on, because it only writes a date exception.
- Removing a weekday rule or closure re-resolves only the affected dates.
- Two representations must stay consistent. Only booking use cases may write them, always in the same transaction.
