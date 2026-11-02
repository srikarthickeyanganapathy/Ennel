import { ErrorCode } from '@ennel/shared';

/**
 * The only error type use cases throw for expected failures. The global filter maps it to
 * `{ code, message, details?, requestId }` (docs/api-contract.md §1.2).
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.ACCOUNT_LOCKED]: 423,
  [ErrorCode.PASSWORD_CHANGE_REQUIRED]: 403,
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VERSION_CONFLICT]: 409,
  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: 409,
  [ErrorCode.ROSTER_NOT_FOUND]: 404,
  [ErrorCode.ALREADY_REGISTERED]: 409,
  [ErrorCode.BOOKING_DEADLINE_PASSED]: 422,
  [ErrorCode.SLOT_UNAVAILABLE]: 422,
  [ErrorCode.BOOKING_NOT_ALLOWED]: 422,
  [ErrorCode.LEAVE_RANGE_INVALID]: 422,
  [ErrorCode.OVERRIDE_REASON_REQUIRED]: 422,
  [ErrorCode.ROSTER_IMPORT_INVALID]: 422,
  [ErrorCode.FILE_INVALID]: 422,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.INTERNAL_ERROR]: 500,
};
