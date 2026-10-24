import { describe, expect, it } from 'vitest';
import { chooseFallbackSlot } from './fallback-slot';

const slot = (slotId: string, startMinute: number, hasSpace: boolean) => ({
  slotId,
  startMinute,
  hasSpace,
});

describe('chooseFallbackSlot (BR-DEF-2, ADR-0006)', () => {
  it('takes the next later slot with space', () => {
    const slots = [
      slot('a', 660, true),
      slot('b', 690, false),
      slot('c', 720, false),
      slot('d', 750, true),
    ];
    expect(chooseFallbackSlot('b', slots)).toBe('d');
  });

  it('wraps round to the earliest slot with space when no later one has space', () => {
    const slots = [
      slot('d', 750, false),
      slot('a', 660, true),
      slot('b', 690, true),
      slot('c', 720, false),
    ];
    expect(chooseFallbackSlot('c', slots)).toBe('a');
  });

  it('returns null when every slot is full', () => {
    expect(chooseFallbackSlot('a', [slot('a', 660, false), slot('b', 690, false)])).toBeNull();
  });
});
