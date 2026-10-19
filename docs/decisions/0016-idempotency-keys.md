# ADR-0016: Idempotency keys for student submissions

- Status: Accepted
- Date: 2026-10-19

## Context

Rule 13 and Spec §14: booking, cancellation, leave and complaint submissions must be safe against double taps and retries after network errors.

## Decision

- Clients send `Idempotency-Key` (a UUID generated when the user starts the action) on those POST/PATCH routes. It is required there.
- An `IdempotencyInterceptor` looks up `(actorKey, key)` in `idempotency_keys`. A hit with the same request hash returns the stored status and body; a hit with a different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
- The record is inserted in the same DB transaction as the use case, so a crash cannot leave a stored response without the change, or the reverse. A concurrent duplicate blocks on the unique index and then replays.
- Keys expire after 24 h and are purged by a daily job.
- The UI also disables buttons while a request is pending.

## Consequences

Use-case services take an optional idempotency context. Domain logic is unaffected.
