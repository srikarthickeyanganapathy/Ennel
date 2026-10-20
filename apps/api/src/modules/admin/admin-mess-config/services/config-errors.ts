import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';

export function notFound(what: string): AppError {
  return new AppError(ErrorCode.NOT_FOUND, `${what} not found.`);
}

export function invalid(path: string, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message, { issues: [{ path, message }] });
}

export function staleVersion(what: string): AppError {
  return new AppError(
    ErrorCode.VERSION_CONFLICT,
    `Someone else changed this ${what}. Reload and try again.`,
  );
}
