import { describe, expect, it } from 'vitest';
import {
  canChangeStatus,
  isClosedStatus,
  referenceCodeFrom,
  submitterSnapshot,
} from './complaint-rules';

describe('complaint status flow (BR-CMP-4)', () => {
  it('moves New to In review, then to Resolved or Rejected', () => {
    expect(canChangeStatus('NEW', 'IN_REVIEW')).toBe(true);
    expect(canChangeStatus('IN_REVIEW', 'RESOLVED')).toBe(true);
    expect(canChangeStatus('IN_REVIEW', 'REJECTED')).toBe(true);
  });

  it('does not skip review, go back, or reopen a closed report', () => {
    expect(canChangeStatus('NEW', 'RESOLVED')).toBe(false);
    expect(canChangeStatus('IN_REVIEW', 'NEW')).toBe(false);
    expect(canChangeStatus('RESOLVED', 'IN_REVIEW')).toBe(false);
    expect(canChangeStatus('REJECTED', 'RESOLVED')).toBe(false);
    expect(isClosedStatus('RESOLVED')).toBe(true);
    expect(isClosedStatus('IN_REVIEW')).toBe(false);
  });
});

describe('submitterSnapshot (BR-CMP-2)', () => {
  const student = { id: 'student-1', hostelBlockId: 'block-1' };

  it('keeps nothing about the student in anonymous mode', () => {
    expect(submitterSnapshot('ANONYMOUS', student)).toEqual({
      studentId: null,
      hostelBlockId: null,
    });
  });

  it('keeps the student and hostel when identified', () => {
    expect(submitterSnapshot('PRIVATE_IDENTIFIED', student)).toEqual({
      studentId: 'student-1',
      hostelBlockId: 'block-1',
    });
  });
});

describe('referenceCodeFrom', () => {
  it('builds a six-character code without look-alike letters', () => {
    const code = referenceCodeFrom(new Uint8Array([0, 1, 2, 31, 32, 255, 9]));
    expect(code).toMatch(/^CMP-[A-HJ-NP-Z2-9]{6}$/);
    expect(code).toBe('CMP-ABC9A9');
  });
});
