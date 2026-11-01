import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { type DayResponse, type MealCard, toBusinessDate } from '@ennel/shared';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { confirmAction } from '@/shared/utils/confirm-action';
import { cancelBooking, getDay } from '@/features/bookings/api/bookings-api';
import { getMyProfile } from '@/features/onboarding/api/onboarding-api';
import { HomeScreen } from './HomeScreen';

jest.mock('@/features/bookings/api/bookings-api');
jest.mock('@/features/onboarding/api/onboarding-api');
jest.mock('@/features/leave/api/leave-api');
jest.mock('@/features/no-shows/api/no-shows-api');
jest.mock('@/shared/utils/confirm-action');

const TODAY = toBusinessDate(new Date());
const inMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000 + 30_000).toISOString();
const CLOSED = { allowed: false, reason: null, deadlineAt: null };
const BOOKING_ID = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

function card(overrides: Partial<MealCard>): MealCard {
  return {
    mealType: 'LUNCH',
    mealName: 'Lunch',
    date: TODAY,
    serviceStartMinute: 660,
    serviceEndMinute: 810,
    label: 'NOT_BOOKED_DEFAULT_OFF',
    appliedRule: 'NONE',
    closureTitle: null,
    booking: null,
    actions: {
      book: { allowed: true, reason: null, deadlineAt: inMinutes(240) },
      changeSlot: CLOSED,
      changeDiet: CLOSED,
      cancel: CLOSED,
    },
    ...overrides,
  };
}

const BOOKED_LUNCH = card({
  label: 'BOOKED_ONCE',
  appliedRule: 'DATE_EXCEPTION',
  booking: {
    id: BOOKING_ID,
    slotId: '7b7f3c1e-1d2a-4c55-9f3e-2b1a0c9d8e71',
    slotLabel: '11:00 AM - 11:30 AM',
    slotStartMinute: 660,
    slotEndMinute: 690,
    dietType: 'VEG',
    status: 'BOOKED',
    source: 'MANUAL',
    isOverCapacity: false,
    isUpdatedByStaff: true,
    version: 1,
  },
  actions: {
    book: CLOSED,
    changeSlot: { allowed: true, reason: null, deadlineAt: inMinutes(120) },
    changeDiet: { allowed: true, reason: null, deadlineAt: inMinutes(60) },
    cancel: { allowed: true, reason: null, deadlineAt: inMinutes(60) },
  },
});

function day(meals: MealCard[]): DayResponse {
  return {
    date: TODAY,
    today: TODAY,
    lastBookableDate: TODAY,
    generatedAt: new Date().toISOString(),
    meals,
  };
}

describe('HomeScreen (Spec §4)', () => {
  beforeEach(() => {
    jest
      .mocked(getMyProfile)
      .mockResolvedValue({ fullName: 'Asha', blockName: 'Block A', roomNumber: '101' } as never);
  });

  it('shows each meal with a text status, its slot, a staff note and countdowns', async () => {
    jest
      .mocked(getDay)
      .mockResolvedValue(
        day([card({ mealType: 'BREAKFAST', mealName: 'Breakfast' }), BOOKED_LUNCH]),
      );
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Not Booked — Default Off')).toBeTruthy();
    expect(screen.getByText('Booked Once')).toBeTruthy();
    expect(screen.getByText('11:00 AM – 11:30 AM · Meal type: Veg')).toBeTruthy();
    expect(screen.getByText('Updated by mess staff')).toBeTruthy();
    expect(screen.getByText('Cancellation closes in 1 hr 1 min.')).toBeTruthy();
    expect(screen.getByText('Slot change closes in 2 hr 1 min.')).toBeTruthy();
  });

  it('opens Slot Selection to book a meal', async () => {
    jest.mocked(getDay).mockResolvedValue(day([card({})]));
    await renderWithProviders(<HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Book Lunch' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(student)/slot-selection',
      params: { date: TODAY, meal: 'LUNCH', mode: 'book' },
    });
  });

  it('cancels only after confirmation, with an idempotency key, and says so', async () => {
    jest.mocked(getDay).mockResolvedValue(day([BOOKED_LUNCH]));
    jest.mocked(cancelBooking).mockResolvedValue({
      ...BOOKED_LUNCH,
      label: 'CANCELLED',
      booking: { ...BOOKED_LUNCH.booking!, status: 'CANCELLED' },
    });
    jest.mocked(confirmAction).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await renderWithProviders(<HomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(cancelBooking).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledTimes(1));
    expect(jest.mocked(cancelBooking).mock.calls[0]?.[0]).toBe(BOOKING_ID);
    expect(jest.mocked(cancelBooking).mock.calls[0]?.[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText(/Lunch cancelled./)).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
  });

  it('explains why an action is closed instead of failing on tap (Spec §14)', async () => {
    jest.mocked(getDay).mockResolvedValue(
      day([
        card({
          actions: {
            book: {
              allowed: false,
              reason: 'All slots for this meal have started.',
              deadlineAt: null,
            },
            changeSlot: CLOSED,
            changeDiet: CLOSED,
            cancel: CLOSED,
          },
        }),
      ]),
    );
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('All slots for this meal have started.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Book Lunch' })).toBeNull();
  });
});
