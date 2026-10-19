import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ennel/shared';
import type { Request } from 'express';
import { AppError } from '../errors/app-error';
import { RateLimiter } from './rate-limiter';

export interface RateLimitRule {
  /** Bucket name, e.g. "student-login". */
  name: string;
  limit: number;
  windowSeconds: number;
}

const RATE_LIMIT_KEY = 'rateLimit';

/** Limits requests per client IP for the decorated route. */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.get<RateLimitRule | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!rule) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const result = await this.limiter.consume(
      `${rule.name}:${request.ip ?? 'unknown'}`,
      rule.limit,
      rule.windowSeconds,
    );
    if (result.isAllowed) return true;
    throw new AppError(ErrorCode.RATE_LIMITED, 'Too many attempts. Please wait and try again.', {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}
