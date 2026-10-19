import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_PERMISSIONS, StaffRole } from '@ennel/shared';
import { getVisibleNavItems } from './nav-items';

describe('getVisibleNavItems', () => {
  it('shows Mess Staff only their counter and kitchen areas', () => {
    const granted = new Set(DEFAULT_ROLE_PERMISSIONS[StaffRole.MESS_STAFF]);
    const labels = getVisibleNavItems(granted).map((item) => item.label);
    expect(labels).toContain('Attendance');
    expect(labels).toContain('Forecasting');
    expect(labels).not.toContain('Audit log');
    expect(labels).not.toContain('Bookings');
  });

  it('shows the Auditor reports and the audit log', () => {
    const granted = new Set(DEFAULT_ROLE_PERMISSIONS[StaffRole.AUDITOR]);
    const labels = getVisibleNavItems(granted).map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(['Reports', 'Audit log', 'Policy']));
    expect(labels).not.toContain('Dashboard');
  });
});
