# ENNEL RBAC Matrix

Source of truth in code: `packages/shared/src/permissions/` (`PERMISSION_KEYS` and `DEFAULT_ROLE_PERMISSIONS`). The seed syncs the `permissions`, `roles` and `role_permissions` tables from it. Only a `SUPER_ADMIN` can change role assignments (`roles:manage`). This file must match the code; Phase 12 verifies it with a test.

Legend: ✓ granted · `·` not granted · **?** assumption approved for Phase 0, still to confirm with mess management (Admin §A).

| Permission                   | SUPER_ADMIN | MESS_MANAGER | MESS_STAFF | WARDEN  | AUDITOR |
| ---------------------------- | :---------: | :----------: | :--------: | :-----: | :-----: |
| `dashboard:read` (any date)  |      ✓      |      ✓       |     ·      | · **?** |    ·    |
| `dashboard:read-today`       |      ✓      |      ✓       |     ✓      |    ✓    |    ·    |
| `staff:read`                 |      ✓      |      ·       |     ·      |    ·    |    ·    |
| `staff:manage`               |      ✓      |      ·       |     ·      |    ·    |    ·    |
| `roles:manage`               |      ✓      |      ·       |     ·      |    ·    |    ·    |
| `policy:read`                |      ✓      |      ✓       |     ·      |    ✓    |    ✓    |
| `policy:update`              |      ✓      |   · **?**    |     ·      |    ·    |    ·    |
| `mess-config:read`           |      ✓      |      ✓       |     ✓      |    ·    |    ·    |
| `mess-config:update`         |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `menus:read`                 |      ✓      |      ✓       |     ✓      |    ✓    |    ·    |
| `menus:update`               |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `menus:publish`              |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `closures:read`              |      ✓      |      ✓       |     ✓      |    ✓    |    ·    |
| `closures:manage`            |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `students:read`              |      ✓      |   ✓ **?**    |     ·      |    ✓    |    ·    |
| `students:update`            |      ✓      |      ·       |     ·      | · **?** |    ·    |
| `students:lock`              |      ✓      |      ·       |     ·      | · **?** |    ·    |
| `students:deactivate`        |      ✓      |      ·       |     ·      |    ·    |    ·    |
| `students:reset-credentials` |      ✓      |      ·       |     ·      | · **?** |    ·    |
| `roster:import`              |      ✓      |   · **?**    |     ·      |    ·    |    ·    |
| `bookings:read`              |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `bookings:override`          |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `bookings:bulk`              |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `attendance:read`            |      ✓      |      ✓       |     ✓      |    ·    |    ·    |
| `attendance:mark`            |      ✓      |      ✓       |     ✓      |    ·    |    ·    |
| `attendance:import`          |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `attendance:outage-toggle`   |      ✓      |      ✓       |  · **?**   |    ·    |    ·    |
| `no-shows:read`              |      ✓      |      ✓       |     ·      | · **?** |    ·    |
| `no-shows:review-appeal`     |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `no-shows:reset`             |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `leaves:read`                |      ✓      |      ✓       |     ·      |    ✓    |    ·    |
| `leaves:approve`             |      ✓      |      ✓       |     ·      |    ✓    |    ·    |
| `leaves:manage`              |      ✓      |      ✓       |     ·      | · **?** |    ·    |
| `complaints:read`            |      ✓      |      ✓       |     ·      |    ✓    |    ·    |
| `complaints:resolve`         |      ✓      |      ✓       |     ·      |    ✓    |    ·    |
| `complaints:note`            |      ✓      |      ✓       |     ·      |    ✓    |    ·    |
| `complaints:assign`          |      ✓      |      ✓       |     ·      | · **?** |    ·    |
| `announcements:read`         |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `announcements:manage`       |      ✓      |      ✓       |     ·      |    ·    |    ·    |
| `forecasting:read`           |      ✓      |      ✓       |     ✓      |    ·    |    ·    |
| `forecasting:export`         |      ✓      |      ✓       |     ✓      |    ·    |    ·    |
| `reports:read`               |      ✓      |      ✓       |     ·      |    ✓    |    ✓    |
| `reports:export`             |      ✓      |      ✓       |     ·      | ✓ **?** |    ✓    |
| `audit-log:read`             |      ✓      |      ·       |     ·      |    ·    |    ✓    |
| `audit-log:export`           |      ✓      |      ·       |     ·      |    ·    |    ✓    |
| `system:read`                |      ✓      |   ✓ **?**    |     ·      |    ·    |    ·    |
| `system:manage`              |      ✓      |      ·       |     ·      |    ·    |    ·    |

## Permission meanings

| Key                                                   | Allows                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `dashboard:read` / `dashboard:read-today`             | Dashboard for any date / for today only                                          |
| `staff:read`, `staff:manage`                          | View staff; create, edit, disable staff, reset their 2FA/sessions                |
| `roles:manage`                                        | Change role → permission mapping and staff role assignment                       |
| `policy:read`, `policy:update`                        | View / edit `mess_policy` (with reason and history)                              |
| `mess-config:*`                                       | Meals, serving windows, slots, capacities and overrides, availability thresholds |
| `menus:*`                                             | Edit draft menus; publish (which may notify students)                            |
| `closures:*`                                          | Create, apply and remove closures and special-meal days                          |
| `students:read`                                       | Student list and detail                                                          |
| `students:update`                                     | Edit college-controlled fields, bulk hostel update                               |
| `students:lock`, `students:deactivate`                | Lock/unlock; deactivate/reactivate                                               |
| `students:reset-credentials`                          | Issue a one-time reset code (password or registration)                           |
| `roster:import`                                       | Upload, validate and confirm roster imports                                      |
| `bookings:read`, `bookings:override`, `bookings:bulk` | Booking grid; create/cancel/move/correct on behalf (with reason); bulk actions   |
| `attendance:*`                                        | Live counter; manual marking; CSV import; outage-mode toggle                     |
| `no-shows:*`                                          | No-show list; decide appeals; reset counts and re-enable Default Booking         |
| `leaves:*`                                            | Leave list; approve/reject; create/end/correct on behalf                         |
| `complaints:*`                                        | Inbox and analytics; change status and reply; internal notes; assignment         |
| `announcements:*`                                     | View history; compose, schedule, edit and send                                   |
| `forecasting:*`                                       | Forecast view; kitchen sheet export                                              |
| `reports:*`                                           | Reports view; export CSV/XLSX/PDF                                                |
| `audit-log:*`                                         | Audit viewer; export                                                             |
| `system:read`, `system:manage`                        | Job and provider health; retry failed jobs                                       |

## Always allowed (any authenticated staff, no key)

Own profile (`GET /admin/auth/me`), own password change, own TOTP enrolment, own session list, "log out everywhere". `GET /admin/hostels` is also open to any signed-in staff member because several pages use it for filter options; changing hostels needs `mess-config:update`.

While a password change is pending (first login or after a reset), only `GET /admin/auth/me` and `POST /admin/auth/change-password` work; everything else returns `PASSWORD_CHANGE_REQUIRED`.

## Routes that need more than one key or a non-obvious key (Phase 2)

| Route                               | Keys                                                             | Why                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/dashboard?date`         | `dashboard:read-today`; another date also needs `dashboard:read` | Mess Staff and Wardens see today only (Admin §C)                                                                     |
| `POST /admin/bookings/bulk/*`       | `bookings:bulk`                                                  | Single overrides need `bookings:override`; the grid needs `bookings:read`                                            |
| `POST /admin/staff-users`           | `staff:manage` + `roles:manage`                                  | A new account is created with roles, so it also needs the role-assignment key                                        |
| `GET /admin/mess-config/thresholds` | `mess-config:read`                                               | Availability thresholds are configuration (ADR-0013), so Mess Staff can see them; editing needs `mess-config:update` |
| `GET /admin/roles`                  | `staff:read`                                                     | The staff page shows role names and their permissions                                                                |
| `PUT /admin/staff-users/{id}/roles` | `roles:manage`                                                   | Role assignment is Super Admin only (Admin §A)                                                                       |

Account safety rules on top of permissions: staff cannot disable themselves or remove their own Super Admin role, and the last active Super Admin cannot be disabled or demoted (checked under a database lock).

## Enforcement

- API: `@AdminController` applies the staff JWT guard and a fail-closed permissions guard to every admin route. Each route declares `@RequirePermissions(...keys)` (all listed keys required), `@AuthenticatedStaffOnly()` or `@PublicAdminRoute()`; a route with none of them is refused. `admin-authorization.int.spec.ts` enumerates every admin route and checks the declaration, 401 without a token or with a student token, and 403 for a role without the key. Permissions are re-read from the database (cached 30 s, cleared on role changes), so a role change takes effect without a new login.
- Student tokens are rejected on `/api/v1/admin/*` (different audience and secret), and staff tokens on student routes.
- Admin UI: `<PermissionGate>` and the permission-aware sidebar are a convenience only.
- Data scoping beyond permissions: `dashboard:read-today` limits the date to today (IST); `ANONYMOUS` complaints never return identity regardless of permission.
