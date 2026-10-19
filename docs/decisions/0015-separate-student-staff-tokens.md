# ADR-0015: Separate student and staff tokens

- Status: Accepted
- Date: 2026-10-19

## Context

The brief requires that a student token is never accepted on an admin route, and the reverse.

## Decision

- Access tokens: students are signed with `JWT_STUDENT_SECRET` and audience `ennel-student`; staff with `JWT_STAFF_SECRET` and audience `ennel-staff`. TTL is 15 minutes.
- Refresh tokens are opaque random values, stored hashed in `student_sessions` / `staff_sessions`. They rotate on every use, and reuse of a rotated token revokes the family.
- Each guard verifies its own secret and audience and checks the subject type claim.
- Staff tokens carry no permissions. `PermissionsGuard` loads the staff member's permissions per request (cached briefly in memory), so role changes and revocation take effect quickly.
- The admin web keeps the refresh token in an httpOnly, SameSite=Strict cookie scoped to `/api/v1/admin/auth`. Mobile keeps it in SecureStore.

## Consequences

Two key sets to manage in `.env`. The authorization suite tests cross-surface rejection for every admin route.
