import { type AdminStudentDetail } from '@ennel/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api-client/api-error';
import { renderWithProviders } from '@/test-utils/render';
import { updateStudent } from '../api/students-api';
import { EditStudentDialog } from './EditStudentDialog';

vi.mock('../api/students-api', () => ({ updateStudent: vi.fn() }));

const STUDENT: AdminStudentDetail = {
  rosterEntryId: '77777777-7777-4777-8777-777777777777',
  studentId: null,
  referenceNumber: '22CS002',
  fullName: 'Ravi Kumar',
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
  email: null,
  phone: null,
  parentPhone: null,
  registeredAt: null,
  onboardingCompletedAt: null,
  lockedUntil: null,
  preferences: [],
  recentBookings: [],
  leaves: [],
  noShowCounts: { BREAKFAST: 0, LUNCH: 0, DINNER: 0 },
  noShowWindowDays: 30,
  complaintsCount: 0,
  rosterVersion: 3,
};

const renderDialog = () =>
  renderWithProviders(
    <EditStudentDialog student={STUDENT} hostels={[]} open onOpenChange={() => undefined} />,
  );
const confirmWithReason = (reason: string) => {
  fireEvent.change(screen.getByLabelText('Reason (recorded in the audit log)'), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
};

describe('EditStudentDialog (Admin §G)', () => {
  it('sends only changed fields and refreshes the student list', async () => {
    vi.mocked(updateStudent).mockResolvedValue({ ...STUDENT, academicYear: 3, rosterVersion: 4 });
    const { queryClient } = renderDialog();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.change(screen.getByLabelText('Academic year'), { target: { value: '3' } });
    confirmWithReason('Promoted');

    await waitFor(() =>
      expect(updateStudent).toHaveBeenCalledWith(STUDENT.rosterEntryId, {
        academicYear: 3,
        hostelBlockId: undefined,
        roomNumber: undefined,
        email: undefined,
        reason: 'Promoted',
        rosterVersion: 3,
      }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['students'] }));
  });

  it('does not send an unchanged save', () => {
    renderDialog();
    confirmWithReason('No reason');
    expect(updateStudent).not.toHaveBeenCalled();
  });

  it('reloads the student after a version conflict', async () => {
    vi.mocked(updateStudent).mockRejectedValue(
      new ApiError('VERSION_CONFLICT', 'Someone else changed this student.', 409),
    );
    const { queryClient } = renderDialog();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.change(screen.getByLabelText('Room'), { target: { value: 'B-12' } });
    confirmWithReason('Room change');

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['student', STUDENT.rosterEntryId] }),
    );
    expect(await screen.findByText('Someone else changed this student.')).toBeInTheDocument();
  });
});
