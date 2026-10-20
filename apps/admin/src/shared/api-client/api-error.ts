import { errorResponseSchema } from '@ennel/shared';

export interface FieldIssue {
  path: string;
  message: string;
}

/** Every API failure, carrying the stable error code and the server's message. */
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

  get fieldIssues(): FieldIssue[] {
    const issues = (this.details as { issues?: unknown } | undefined)?.issues;
    if (!Array.isArray(issues)) return [];
    return issues.filter(
      (issue): issue is FieldIssue =>
        typeof issue === 'object' && issue !== null && 'path' in issue && 'message' in issue,
    );
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const body: unknown = await response.json().catch(() => undefined);
    const parsed = errorResponseSchema.safeParse(body);
    if (parsed.success) {
      return new ApiError(
        parsed.data.code,
        parsed.data.message,
        response.status,
        parsed.data.details,
      );
    }
    return new ApiError(
      'INVALID_RESPONSE',
      'Something went wrong. Please try again.',
      response.status,
    );
  }
}

/** A readable message for any error thrown by a query or mutation. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const issues = error.fieldIssues.map((issue) => issue.message);
    return issues.length > 1 ? `${error.message} ${issues.join('. ')}` : error.message;
  }
  return 'Something went wrong. Please try again.';
}
