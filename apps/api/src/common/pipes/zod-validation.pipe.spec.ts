import { ErrorCode } from '@ennel/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../errors/app-error';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ page: z.coerce.number().int().min(1) }));

  it('returns parsed data', () => {
    expect(pipe.transform({ page: '2' })).toEqual({ page: 2 });
  });

  it('throws VALIDATION_FAILED with field paths', () => {
    try {
      pipe.transform({ page: '0' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.VALIDATION_FAILED);
      expect((error as AppError).details).toMatchObject({ issues: [{ path: 'page' }] });
    }
  });
});
