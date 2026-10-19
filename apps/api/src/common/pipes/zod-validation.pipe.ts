import { type PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { type ZodType } from 'zod';
import { AppError } from '../errors/app-error';

/** Validates a request part against a shared Zod schema ("validate at every boundary"). */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError(ErrorCode.VALIDATION_FAILED, 'The request is invalid.', { issues });
  }
}
