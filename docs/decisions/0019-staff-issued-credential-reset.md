# ADR-0019: Staff-issued credential reset without email or SMS

- Status: Accepted (default), revisit if email/SMS becomes available
- Date: 2026-10-19

## Context

Spec §3 Screen 2 mentions a "normal login/reset flow". Admin §G requires a reset that "generates a reset flow, never reveals a password". There is no email or SMS provider in the stack.

## Decision

- Staff with `students:reset-credentials` create a `credential_reset_tickets` row (kind `PASSWORD` or `REGISTRATION`, with a reason). They are shown a 10-character one-time code **once**. Only its argon2 hash is stored. It expires after 24 h, and a new ticket invalidates earlier unused ones.
- The student enters their reference number and the code (`POST /auth/reset-with-code`) and sets a new password. All student sessions are revoked.
- `REGISTRATION` reset also clears onboarding, so the student goes through Screens 5–8 again. Bookings and history are kept.
- The endpoint is rate-limited per reference number and IP. Five wrong codes invalidate the ticket.

## Consequences

The code reaches the student out of band (in person at the mess office). An email/SMS channel can later deliver the same ticket without changing the model.
