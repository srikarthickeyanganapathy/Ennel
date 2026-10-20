import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type PermissionKey } from '@ennel/shared';
import { StaffPermissionsService } from '../../modules/admin/rbac/services/staff-permissions.service';
import { getRequestContext } from '../context/request-context';
import {
  AUTHENTICATED_STAFF_ONLY_KEY,
  PUBLIC_ADMIN_ROUTE_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/admin-metadata.keys';
import { type StaffRequest } from '../decorators/current-staff.decorator';
import { AppError } from '../errors/app-error';

/**
 * Enforces @RequirePermissions on every admin route (Admin §A). A route that declares
 * nothing is denied: the guard fails closed so a forgotten decorator cannot open an endpoint.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: StaffPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.read<boolean>(context, PUBLIC_ADMIN_ROUTE_KEY)) return true;
    const required = this.read<PermissionKey[]>(context, REQUIRED_PERMISSIONS_KEY);
    const isAuthOnly = this.read<boolean>(context, AUTHENTICATED_STAFF_ONLY_KEY) === true;
    if (!required && !isAuthOnly) {
      this.logger.error(
        `Admin route without a permission declaration: ${context.getHandler().name}`,
      );
      throw new AppError(ErrorCode.PERMISSION_DENIED, 'You do not have access to this action.');
    }

    const staff = context.switchToHttp().getRequest<StaffRequest>().staff;
    const access = staff ? await this.permissions.getAccess(staff.id) : null;
    if (!access?.isActive) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'This account is not active.');
    }
    const actor = getRequestContext()?.actor;
    if (actor) actor.roles = access.roles;

    const granted = new Set(access.permissions);
    if (isAuthOnly || (required ?? []).every((key) => granted.has(key))) return true;
    throw new AppError(ErrorCode.PERMISSION_DENIED, 'You do not have access to this action.', {
      required,
    });
  }

  private read<T>(context: ExecutionContext, key: string): T | undefined {
    return this.reflector.getAllAndOverride<T | undefined>(key, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
