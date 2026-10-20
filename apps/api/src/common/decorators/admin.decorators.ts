import { applyDecorators, Controller, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type PermissionKey } from '@ennel/shared';
import { PermissionsGuard } from '../guards/permissions.guard';
import { StaffJwtAuthGuard } from '../guards/staff-jwt-auth.guard';

import {
  ALLOW_PENDING_PASSWORD_CHANGE_KEY,
  AUTHENTICATED_STAFF_ONLY_KEY,
  PUBLIC_ADMIN_ROUTE_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './admin-metadata.keys';

/**
 * Every staff route lives under /api/v1/admin behind the staff guard and the permissions
 * guard (Admin §A, ADR-0015). Routes then declare what they need with one of the decorators below.
 */
export function AdminController(path: string): ClassDecorator {
  return applyDecorators(
    Controller(`admin/${path}`),
    UseGuards(StaffJwtAuthGuard, PermissionsGuard),
    ApiTags(`admin-${path.split('/')[0] ?? path}`),
    ApiBearerAuth(),
  );
}

/** All listed permissions are required. The API is the authority; the UI only hides controls. */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/** Signed-in staff only, no permission key: own profile, password, sessions, 2FA. */
export const AuthenticatedStaffOnly = () => SetMetadata(AUTHENTICATED_STAFF_ONLY_KEY, true);

/** Reachable while a forced password change is pending (Admin §B). */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);

/** Login and refresh: no access token yet. */
export const PublicAdminRoute = () => SetMetadata(PUBLIC_ADMIN_ROUTE_KEY, true);
