import { describe, expect, it } from 'vitest';
import { findForbiddenFields, getEditableFields, pickEditableChanges } from './editable-fields';

const DEFAULT_CONTROLLED = ['fullName', 'department', 'academicYear'];

describe('editable profile fields (ADR-0018)', () => {
  it('excludes college-controlled fields', () => {
    expect(getEditableFields(DEFAULT_CONTROLLED)).toEqual([
      'hostelBlockId',
      'roomNumber',
      'phone',
      'parentPhone',
      'email',
    ]);
  });

  it('reports attempts to change controlled fields', () => {
    expect(findForbiddenFields({ fullName: 'X', roomNumber: '1' }, DEFAULT_CONTROLLED)).toEqual([
      'fullName',
    ]);
  });

  it('allows every field when nothing is controlled', () => {
    expect(findForbiddenFields({ fullName: 'X', academicYear: 2 }, [])).toEqual([]);
  });

  it('drops controlled and undefined values from onboarding changes', () => {
    expect(
      pickEditableChanges({ fullName: 'X', roomNumber: '1', email: undefined }, DEFAULT_CONTROLLED),
    ).toEqual({ roomNumber: '1' });
  });
});
