import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../common/errors/app-error';
import { Prisma } from '../../generated/prisma/client';

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Runs a write whose uniqueness the service already checked. If a parallel request won the race,
 * the unique index rejects this one, and the caller gets the same validation error instead of a 500.
 */
export async function withUniqueField<T>(
  field: string,
  message: string,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    throw new AppError(ErrorCode.VALIDATION_FAILED, message, {
      issues: [{ path: field, message }],
    });
  }
}
