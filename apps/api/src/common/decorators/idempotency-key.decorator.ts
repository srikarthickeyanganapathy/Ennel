import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ErrorCode, IDEMPOTENCY_KEY_HEADER, idempotencyKeySchema } from '@ennel/shared';
import type { Request } from 'express';
import { AppError } from '../errors/app-error';

/** The required `Idempotency-Key` header (a UUID) on booking writes (ADR-0016). */
export const IdempotencyKey = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  const parsed = idempotencyKeySchema.safeParse(request.header(IDEMPOTENCY_KEY_HEADER));
  if (parsed.success) return parsed.data;
  const message = 'Send a new Idempotency-Key (a UUID) with this request.';
  throw new AppError(ErrorCode.VALIDATION_FAILED, message, {
    issues: [{ path: IDEMPOTENCY_KEY_HEADER, message }],
  });
});
