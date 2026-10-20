import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedStaff {
  id: string;
  /** The session the access token was issued for, used to mark "this device". */
  sessionId: string | null;
}

export interface StaffRequest extends Request {
  staff?: AuthenticatedStaff;
}

/** The staff member set by StaffJwtAuthGuard. */
export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedStaff => {
    const staff = context.switchToHttp().getRequest<StaffRequest>().staff;
    if (!staff) throw new Error('CurrentStaff used on a route without StaffJwtAuthGuard');
    return staff;
  },
);
