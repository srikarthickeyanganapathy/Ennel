import { type AdminStudentListItem } from '@ennel/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { listHostels, listStudents } from '../api/students-api';
import { StudentsPage } from './StudentsPage';

const auth = mockAuth(['students:read', 'students:update']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/students-api', () => ({
  listStudents: vi.fn(),
  listHostels: vi.fn(),
  bulkUpdateHostel: vi.fn(),
}));

const STUDENT: AdminStudentListItem = {
  rosterEntryId: '66666666-6666-4666-8666-666666666666',
  studentId: null,
  referenceNumber: '22CS001',
  fullName: 'Asha Rao',
  department: 'CSE',
  academicYear: 2,
  hostelBlockId: null,
  hostelName: null,
  blockName: null,
  roomNumber: null,
  isRegistered: false,
  isRosterActive: true,
  status: null,
  defaultBookingEnabled: null,
};

describe('StudentsPage bulk hostel move (Admin §G)', () => {
  it('clears the selection when a filter changes, so hidden students are never moved', async () => {
    vi.mocked(listStudents).mockResolvedValue({
      items: [STUDENT],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(listHostels).mockResolvedValue([]);
    renderWithProviders(<StudentsPage />);

    fireEvent.click(await screen.findByLabelText('Select Asha Rao'));
    expect(screen.getByRole('button', { name: /Move 1 to hostel/ })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Search students'), { target: { value: 'zzz' } });
    expect(screen.getByRole('button', { name: /Move\s+to hostel/ })).toBeDisabled();
  });
});
