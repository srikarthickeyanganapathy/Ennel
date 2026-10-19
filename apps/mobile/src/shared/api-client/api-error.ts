import { errorResponseSchema } from '@ennel/shared';

/** Client-only codes for failures that never reached the server. */
export const ClientErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

export interface FieldIssue {
  path: string;
  message: string;
}

/** Every API failure, with the server's stable code and user-facing message (Spec §14). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages from VALIDATION_FAILED responses. */
  get fieldIssues(): FieldIssue[] {
    const issues = (this.details as { issues?: unknown } | undefined)?.issues;
    if (!Array.isArray(issues)) return [];
    return issues.filter(
      (issue): issue is FieldIssue =>
        typeof issue === 'object' && issue !== null && 'path' in issue && 'message' in issue,
    );
  }

  static fromResponse(status: number, body: unknown): ApiError {
    const parsed = errorResponseSchema.safeParse(body);
    if (parsed.success) {
      return new ApiError(parsed.data.code, parsed.data.message, status, parsed.data.details);
    }
    return new ApiError(
      ClientErrorCode.INVALID_RESPONSE,
      'Something went wrong. Please try again.',
      status,
    );
  }

  static network(): ApiError {
    return new ApiError(
      ClientErrorCode.NETWORK_ERROR,
      'Check your internet connection and try again.',
      0,
    );
  }
}
