# ADR-0011: Policy `bookingHorizonDays`

- Status: Accepted (default), pending institutional approval
- Date: 2026-10-19

## Context

Spec §4.2 and §6.1 mention an "allowed booking horizon" and "allowed planning horizon" but give no value.

## Decision

- `mess_policy.booking_horizon_days`, default **7**, range 1–60.
- Students can view and book dates from today to today + horizon. Default Booking generation materializes the same range nightly.
- Weekday rules have no horizon: they are recurring intent, materialized only within the horizon.

## Consequences

A short horizon keeps forecast inputs fresh and limits re-resolution work when config changes. Raising it later only needs the job to backfill.
