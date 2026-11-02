import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_PERMISSIONS, StaffRole } from '@ennel/shared';
import { getVisibleNavItems } from './nav-items';

const labelsFor = (role: StaffRole) =>
  getVisibleNavItems(new Set(DEFAULT_ROLE_PERMISSIONS[role])).map((item) => item.label);

describe('getVisibleNavItems (Admin UX: permission-aware sidebar)', () => {
  it('shows Mess Staff only what their counter and kitchen work needs', () => {
    expect(labelsFor(StaffRole.MESS_STAFF)).toEqual([
      'Dashboard',
      'Meal forecast',
      'Attendance',
      'Menu',
      'Closures',
      'Slots & capacity',
      'Hostels',
    ]);
  });

  it('shows the Auditor policy and the audit log but not operations', () => {
    expect(labelsFor(StaffRole.AUDITOR)).toEqual(['Settings & rules', 'Reports', 'Audit log']);
  });

  it('shows Wardens students but not bookings or staff management', () => {
    const labels = labelsFor(StaffRole.WARDEN);
    expect(labels).toContain('Students');
    expect(labels).toContain('Leaves');
    expect(labels).toContain('Complaints');
    expect(labels).not.toContain('Announcements');
    expect(labels).not.toContain('Bookings');
    expect(labels).not.toContain('Staff & roles');
  });

  it('shows the Super Admin everything', () => {
    expect(labelsFor(StaffRole.SUPER_ADMIN)).toHaveLength(17);
    expect(labelsFor(StaffRole.MESS_MANAGER)).toContain('Bookings');
    expect(labelsFor(StaffRole.MESS_MANAGER)).toContain('Attendance');
    expect(labelsFor(StaffRole.MESS_MANAGER)).toContain('Announcements');
  });
});
