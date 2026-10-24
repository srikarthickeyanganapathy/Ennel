# ADR-0021: Staff account protection and immediate session revocation

- Status: Accepted (approved by the project owner, 2026-10-24)
- Date: 2026-10-24

## Context

The Phase 1–2 bug review raised four security questions that the requirements did not answer:

1. `staff:manage` alone allowed resetting or disabling a Super Admin, and receiving their temporary password.
2. Wrong current passwords on "change password" did not count towards lockout.
3. "Log out everywhere", logout and password changes left issued access tokens valid for up to 15 minutes.
4. Student login answered `ACCOUNT_LOCKED` for deactivated or staff-locked accounts before checking the password, which told anyone the account existed (BR-AUTH-9).

## Decision

1. **Super Admin accounts:** resetting the password or 2FA, disabling, enabling or renaming a Super Admin requires the actor to be a Super Admin (`assertMayManageAccount`, `PERMISSION_DENIED` otherwise). This holds even if a Super Admin grants `staff:manage` to another role.
2. **Change password:** a wrong current password is a failed sign-in (BR-AUTH-3). Reaching the limit locks the account and ends every session.
3. **Revocation is immediate:** student and staff access tokens carry their session id (`sid`). Both guards check on every request that the session exists, belongs to the user and is not revoked. A rotated (refreshed) session stays valid until its access token expires; a revoked one does not. Student tokens issued before this change have no `sid` and are refused, so those students refresh or sign in once.
4. **Account status after the password:** for students and staff, deactivated, staff-locked or disabled status is reported only after the correct password. A temporary lockout after 5 failures is still reported straight away, because the student needs to know to wait; unknown reference numbers never lock, so this reveals only numbers someone has already tried 5 times.

Also: a parallel duplicate staff email or hostel/block name now returns `VALIDATION_FAILED`, not a 500 (`withUniqueField`).

## Consequences

One extra primary-key lookup per authenticated request. Tests: `test/integration/security-decisions.int.spec.ts`.
