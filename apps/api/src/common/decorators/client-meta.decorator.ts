import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestClientMeta {
  ip?: string;
  userAgent?: string;
}

/** IP and user agent for session records and audit entries. */
export const ClientMeta = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestClientMeta => {
    const request = context.switchToHttp().getRequest<Request>();
    return { ip: request.ip, userAgent: request.header('user-agent') };
  },
);
