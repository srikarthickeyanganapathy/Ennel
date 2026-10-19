# ADR-0002: Business time zone, date and slot-time storage

- Status: Accepted
- Date: 2026-10-19

## Context

Rule 6 fixes business time to Asia/Kolkata and storage to UTC. Meals belong to a calendar date in IST, while deadlines are instants. A meal at 7:00 AM IST on 20 Oct is 01:30 UTC on 20 Oct, but "today" must still mean the IST date.

## Decision

- Instants (`created_at`, `cancelled_at`, `verified_at`, deadlines) are `timestamptz` in UTC.
- Business dates (`meal_date`, leave and closure dates) are Postgres `DATE` meaning an IST calendar date. They are exchanged as `YYYY-MM-DD` strings.
- Slot and serving-window times are integers: minutes since IST midnight (`start_minute`, `end_minute`). IST has no DST, so (date, minute) → instant is unambiguous.
- One helper in `@ennel/shared` (`toInstant(mealDate, minute)`, `toBusinessDate(instant)`), built on `date-fns-tz`, is the only conversion path. Domain functions take `now: Date` as a parameter.

## Consequences

- No time-zone arithmetic is scattered through the code; midnight rollover is tested in one place.
- Prisma returns `DATE` columns as JS `Date` at UTC midnight; repositories map them to `YYYY-MM-DD` strings immediately.
