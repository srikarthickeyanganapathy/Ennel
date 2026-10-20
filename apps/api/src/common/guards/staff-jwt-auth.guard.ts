import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ennel/shared';
import { StaffAccessTokenService } from '../../modules/admin/admin-auth/services/staff-access-token.service';
import { getRequestContext } from '../context/request-context';
import {
  ALLOW_PENDING_PASSWORD_CHANGE_KEY,
  PUBLIC_ADMIN_ROUTE_KEY,
} from '../decorators/admin-metadata.keys';
import { type StaffRequest } from '../decorators/current-staff.decorator';
import { AppError } from '../errors/app-error';
import { extractBearerToken } from './student-jwt-auth.guard';

/**
 * Guards /api/v1/admin. Student tokens fail: different secret and audience (ADR-0015).
 * Until a forced password change is done, only routes marked AllowPendingPasswordChange work.
 */
@Injectable()
export class StaffJwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: StaffAccessTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isMarked(context, PUBLIC_ADMIN_ROUTE_KEY)) return true;
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const token = extractBearerToken(request.header('authorization'));
    const claims = token ? await this.tokens.verify(token) : null;
    if (!claims) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Please sign in to continue.');

    if (claims.mustChangePassword && !this.isMarked(context, ALLOW_PENDING_PASSWORD_CHANGE_KEY)) {
      throw new AppError(
        ErrorCode.PASSWORD_CHANGE_REQUIRED,
        'Change your password before continuing.',
      );
    }
    request.staff = { id: claims.staffId, sessionId: claims.sessionId };
    const requestContext = getRequestContext();
    if (requestContext) requestContext.actor = { type: 'STAFF', id: claims.staffId, roles: [] };
    return true;
  }

  private isMarked(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(key, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
