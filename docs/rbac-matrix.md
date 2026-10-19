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

Own profile (`GET /admin/auth/me`), own password change, own TOTP enrolment, own session list, "log out everywhere".

## Enforcement

- API: `@RequirePermissions(...keys)` on every admin route (all listed keys required). A test enumerates admin routes and fails if a route lacks the decorator.
- Student tokens are rejected on `/api/v1/admin/*` (different audience and secret), and staff tokens on student routes.
- Admin UI: `<PermissionGate>` and the permission-aware sidebar are a convenience only.
- Data scoping beyond permissions: `dashboard:read-today` limits the date to today (IST); `ANONYMOUS` complaints never return identity regardless of permission.
