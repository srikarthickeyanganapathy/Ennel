import { describe, expect, it } from 'vitest';
import {
  type Audience,
  audienceProblem,
  isEditable,
  isScheduleValid,
  normaliseAudience,
} from './announcement-rules';

const empty: Audience = {
  type: 'ALL',
  hostelIds: [],
  blockIds: [],
  academicYears: [],
  referenceNumbers: [],
};

describe('announcement rules (Admin §M)', () => {
  it('can edit drafts and scheduled ones only', () => {
    expect(isEditable('DRAFT')).toBe(true);
    expect(isEditable('SCHEDULED')).toBe(true);
    expect(isEditable('SENDING')).toBe(false);
    expect(isEditable('SENT')).toBe(false);
    expect(isEditable('CANCELLED')).toBe(false);
  });

  it('needs a target for every audience type except everyone', () => {
    expect(audienceProblem(empty)).toBeNull();
    expect(audienceProblem({ ...empty, type: 'HOSTEL' })).toBe('Choose at least one hostel.');
    expect(audienceProblem({ ...empty, type: 'CUSTOM' })).toBe(
      'Add at least one reference number.',
    );
    expect(audienceProblem({ ...empty, type: 'ACADEMIC_YEAR', academicYears: [2] })).toBeNull();
  });

  it('keeps only the targets of the chosen type, without duplicates', () => {
    const audience = normaliseAudience({
      ...empty,
      type: 'CUSTOM',
      hostelIds: ['ignored'],
      referenceNumbers: ['24 900 001', '24900001', '24-900-002'],
    });
    expect(audience).toEqual({
      ...empty,
      type: 'CUSTOM',
      referenceNumbers: ['24900001', '24900002'],
    });
  });

  it('schedules at least a minute ahead', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    expect(isScheduleValid(new Date('2026-11-01T10:00:30Z'), now)).toBe(false);
    expect(isScheduleValid(new Date('2026-11-01T10:01:00Z'), now)).toBe(true);
  });
});
