import { describe, expect, it } from 'vitest';
import {
  businessDateSchema,
  overrideReasonSchema,
  paginationQuerySchema,
} from './common.schema.js';

describe('common schemas', () => {
  it('applies list defaults and coerces query strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, sortOrder: 'asc' });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
  });

  it('caps the page size', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });

  it('requires a non-blank override reason', () => {
    expect(overrideReasonSchema.safeParse('   ').success).toBe(false);
    expect(overrideReasonSchema.parse('  student request  ')).toBe('student request');
  });

  it('accepts only real calendar dates', () => {
    expect(businessDateSchema.safeParse('2026-10-19').success).toBe(true);
    expect(businessDateSchema.safeParse('2026-02-29').success).toBe(false);
  });
});
