import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { type BookingHistoryItem, type BookingRecord } from '@ennel/shared';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { getBookingHistory, getBookingRecord } from '../api/booking-history-api';
import { BookingRecordScreen } from './BookingRecordScreen';
import { MyBookingsScreen } from './MyBookingsScreen';

jest.mock('../api/booking-history-api');
jest.mock('@/features/no-shows/api/no-shows-api');

const ID = '11111111-1111-4111-8111-111111111111';
const item = (overrides: Partial<BookingHistoryItem>): BookingHistoryItem => ({
  id: ID,
  date: '2026-10-24',
  mealType: 'BREAKFAST',
  mealName: 'Breakfast',
  slotLabel: '7:30 AM - 8:00 AM',
  dietType: 'VEG',
  status: 'COMPLETED',
  source: 'DEFAULT',
  cancelledAt: null,
  attendance: {
    source: 'FACE_VERIFICATION',
    verifiedAt: '2026-10-24T02:35:00.000Z',
    recordedAt: '2026-10-24T02:35:00.000Z',
  },
  isUpdatedByStaff: false,
  ...overrides,
});
const page = (items: BookingHistoryItem[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  from: '2026-09-24',
  to: '2026-11-01',
});

describe('MyBookingsScreen (Spec §7)', () => {
  it('shows each final record with its outcome and filters by status', async () => {
    jest.mocked(getBookingHistory).mockResolvedValue(
      page([
        item({}),
        item({
          id: '22222222-2222-4222-8222-222222222222',
          mealType: 'DINNER',
          mealName: 'Dinner',
          status: 'NO_SHOW',
          attendance: null,
        }),
      ]),
    );
    await renderWithProviders(<MyBookingsScreen />);

    expect(await screen.findByText('Face Verified at 8:05 AM')).toBeTruthy();
    expect(screen.getByText('Meal window ended without recorded attendance')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('No-show'));
    await waitFor(() =>
      expect(getBookingHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'NO_SHOW', page: 1 }),
      ),
    );
    // The filtered page renders after its refetch, so wait for the rows to come back.
    await fireEvent.press((await screen.findAllByText('View Details ›'))[0] as never);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(student)/booking-record/[id]',
      params: { id: ID },
    });
  });
});

describe('BookingRecordScreen (Spec §7, BR-ATT-1)', () => {
  const record = (overrides: Partial<BookingRecord>): BookingRecord => ({
    ...item({}),
    slotStartMinute: 450,
    slotEndMinute: 480,
    bookedAt: '2026-10-23T19:00:00.000Z',
    closureTitle: null,
    noShow: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: ID });
  });

  it('shows the face verification time from the attendance system', async () => {
    jest.mocked(getBookingRecord).mockResolvedValue(record({}));
    await renderWithProviders(<BookingRecordScreen />);

    expect(await screen.findByText('at 8:05 AM')).toBeTruthy();
    expect(screen.getByText('Default Booking')).toBeTruthy();
  });

  it('never shows a verification time for a manual mark', async () => {
    jest.mocked(getBookingRecord).mockResolvedValue(
      record({
        attendance: {
          source: 'MANUAL_FALLBACK',
          verifiedAt: null,
          recordedAt: '2026-10-24T02:40:00.000Z',
        },
      }),
    );
    await renderWithProviders(<BookingRecordScreen />);

    expect(await screen.findByText(/Marked at the counter by mess staff, 8:10 AM/)).toBeTruthy();
    expect(screen.queryByText('Face Verified')).toBeNull();
  });
});
