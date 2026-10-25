import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { type Leave, type LeavesResponse } from '@ennel/shared';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { confirmAction } from '@/shared/utils/confirm-action';
import { applyLeave, endLeave, getLeave, getLeaves, previewLeave } from '../api/leave-api';
import { ApplyLeaveScreen } from './ApplyLeaveScreen';
import { LeaveDetailScreen } from './LeaveDetailScreen';
import { LeaveScreen } from './LeaveScreen';

jest.mock('../api/leave-api');
jest.mock('@/shared/utils/confirm-action');

const ID = '11111111-1111-4111-8111-111111111111';
const LEAVE: Leave = {
  id: ID,
  startDate: '2099-05-22',
  startMealType: 'BREAKFAST',
  endDate: '2099-05-31',
  endMealType: 'DINNER',
  reason: null,
  status: 'APPROVED',
  state: 'UPCOMING',
  days: 10,
  meals: 30,
  rejectionReason: null,
  isCreatedByStaff: false,
  createdAt: '2099-05-01T05:00:00.000Z',
  decidedAt: '2099-05-01T05:00:00.000Z',
  version: 1,
  canChange: true,
};
const LEAVES: LeavesResponse = {
  current: { status: 'UPCOMING', leave: LEAVE },
  items: [LEAVE],
  earliestStart: { date: '2099-05-20', mealType: 'LUNCH' },
  requiresApproval: false,
};

beforeEach(() => {
  jest.mocked(getLeaves).mockResolvedValue(LEAVES);
});

describe('LeaveScreen (Spec §11.2)', () => {
  it('shows the current status and the history', async () => {
    await renderWithProviders(<LeaveScreen />);

    expect(await screen.findByRole('header', { name: 'Upcoming Leave' })).toBeTruthy();
    expect(screen.getAllByText('Fri, 22 May, Breakfast → Sun, 31 May, Dinner')).toHaveLength(2);
    expect(screen.getByText('10 days, 30 meals skipped')).toBeTruthy();
  });
});

describe('ApplyLeaveScreen (Spec §11.1)', () => {
  it('shows the summary, confirms and submits the exact meal range', async () => {
    jest.mocked(previewLeave).mockResolvedValue({
      days: 3,
      meals: 7,
      status: 'APPROVED',
      bookingsToPause: 2,
      earliestStart: { date: '2099-05-20', mealType: 'LUNCH' },
      problem: null,
    });
    jest.mocked(confirmAction).mockResolvedValue(true);
    jest.mocked(applyLeave).mockResolvedValue({
      leave: LEAVE,
      extensionRequest: null,
      bookingsPaused: 2,
      bookingsResumed: 0,
    });
    await renderWithProviders(<ApplyLeaveScreen />);

    await fireEvent.press(await screen.findByLabelText('To Date: not chosen'));
    await fireEvent.press(screen.getByLabelText('Fri, 22 May'));
    expect(await screen.findByText('3 days, 7 meals skipped')).toBeTruthy();
    expect(screen.getByText(/2 booked meals will be paused/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Apply Leave'));
    await waitFor(() =>
      expect(applyLeave).toHaveBeenCalledWith(
        {
          startDate: '2099-05-20',
          startMealType: 'LUNCH',
          endDate: '2099-05-22',
          endMealType: 'DINNER',
          reason: undefined,
        },
        expect.any(String),
      ),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/(student)/leave/[id]',
      params: { id: ID },
    });
  });

  it('shows why a range cannot be submitted', async () => {
    jest.mocked(previewLeave).mockResolvedValue({
      days: 0,
      meals: 0,
      status: 'APPROVED',
      bookingsToPause: 0,
      earliestStart: { date: '2099-05-20', mealType: 'LUNCH' },
      problem: 'This overlaps another leave. Extend or change that leave instead.',
    });
    await renderWithProviders(<ApplyLeaveScreen />);

    await fireEvent.press(await screen.findByLabelText('To Date: not chosen'));
    await fireEvent.press(screen.getByLabelText('Fri, 22 May'));
    expect(await screen.findByText(/overlaps another leave/)).toBeTruthy();
  });
});

describe('LeaveDetailScreen (Spec §11.2)', () => {
  it('cancels a leave that has not started yet after confirmation', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: ID });
    jest.mocked(getLeave).mockResolvedValue(LEAVE);
    jest.mocked(confirmAction).mockResolvedValue(true);
    jest.mocked(endLeave).mockResolvedValue({
      leave: { ...LEAVE, status: 'CANCELLED', state: 'CANCELLED', canChange: false },
      extensionRequest: null,
      bookingsPaused: 0,
      bookingsResumed: 9,
    });
    await renderWithProviders(<LeaveDetailScreen />);

    await fireEvent.press(await screen.findByText('Cancel Leave', { exact: true }));
    await waitFor(() =>
      expect(endLeave).toHaveBeenCalledWith(ID, {
        resumeDate: '2099-05-22',
        resumeMealType: 'BREAKFAST',
        version: 1,
      }),
    );
    expect(await screen.findByText(/9 meals booked again/)).toBeTruthy();
  });
});
