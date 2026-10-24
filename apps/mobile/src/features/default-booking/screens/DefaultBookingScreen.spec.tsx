import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { type DefaultMealSettings, type DefaultPreferences } from '@ennel/shared';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { confirmAction } from '@/shared/utils/confirm-action';
import {
  getDefaultPreferences,
  saveDefaultPreferences,
  updateMealPreference,
} from '../api/default-booking-api';
import { ChangeSlotsScreen } from './ChangeSlotsScreen';
import { DefaultBookingScreen } from './DefaultBookingScreen';

jest.mock('../api/default-booking-api');
jest.mock('@/shared/utils/confirm-action');

const EARLY = '11111111-1111-4111-8111-111111111111';
const LATE = '22222222-2222-4222-8222-222222222222';

function meal(overrides: Partial<DefaultMealSettings>): DefaultMealSettings {
  return {
    mealType: 'LUNCH',
    mealName: 'Lunch',
    serviceStartMinute: 720,
    serviceEndMinute: 840,
    isEnabled: true,
    slotId: EARLY,
    slotLabel: '12:00 PM - 12:30 PM',
    dietType: 'VEG',
    isAutoDisabled: false,
    slots: [
      { slotId: EARLY, label: '12:00 PM - 12:30 PM', startMinute: 720, endMinute: 750 },
      { slotId: LATE, label: '1:00 PM - 1:30 PM', startMinute: 780, endMinute: 810 },
    ],
    nextDate: '2099-01-02',
    nextDateStatus: 'FILLING_FAST',
    ...overrides,
  };
}

const PREFERENCES: DefaultPreferences = {
  defaultBookingEnabled: true,
  fallbackPolicy: 'ASK_STUDENT',
  meals: [
    meal({ mealType: 'BREAKFAST', mealName: 'Breakfast', isEnabled: false, slots: [] }),
    meal({}),
    meal({ mealType: 'DINNER', mealName: 'Dinner', isAutoDisabled: true }),
  ],
};

describe('DefaultBookingScreen (Spec §8)', () => {
  beforeEach(() => {
    jest.mocked(getDefaultPreferences).mockResolvedValue(PREFERENCES);
  });

  it('shows each meal with its slot, status and the full-slot rule', async () => {
    await renderWithProviders(<DefaultBookingScreen />);

    expect(await screen.findAllByText('12:00 PM - 12:30 PM · Veg')).toHaveLength(3);
    expect(screen.getByText('Filling Fast')).toBeTruthy();
    expect(screen.getByText(/Paused after repeated No-shows/)).toBeTruthy();
    expect(screen.getByText(/the meal is not booked automatically/)).toBeTruthy();
  });

  it('asks before pausing everything and then shows what changed', async () => {
    jest.mocked(confirmAction).mockResolvedValue(true);
    jest.mocked(saveDefaultPreferences).mockResolvedValue({
      preferences: { ...PREFERENCES, defaultBookingEnabled: false },
      changes: [{ mealType: null, field: 'DEFAULT_BOOKING', from: 'ON', to: 'OFF' }],
      bookingsUpdated: 4,
    });
    await renderWithProviders(<DefaultBookingScreen />);

    await fireEvent(await screen.findByLabelText('Default Booking'), 'valueChange', false);
    await waitFor(() =>
      expect(saveDefaultPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBookingEnabled: false }),
      ),
    );
    expect(confirmAction).toHaveBeenCalled();
    expect(await screen.findByText(/Default Booking turned OFF/)).toBeTruthy();
    expect(screen.getByText(/4 upcoming bookings were updated/)).toBeTruthy();
  });

  it('turns one meal off without touching the others', async () => {
    jest.mocked(updateMealPreference).mockResolvedValue({
      preferences: PREFERENCES,
      changes: [{ mealType: 'LUNCH', field: 'ENABLED', from: 'ON', to: 'OFF' }],
      bookingsUpdated: 1,
    });
    await renderWithProviders(<DefaultBookingScreen />);

    await fireEvent(await screen.findByLabelText('Lunch automatic booking'), 'valueChange', false);
    await waitFor(() =>
      expect(updateMealPreference).toHaveBeenCalledWith('LUNCH', { isEnabled: false }),
    );
    expect(saveDefaultPreferences).not.toHaveBeenCalled();
  });

  it('opens one meal’s settings from its card', async () => {
    await renderWithProviders(<DefaultBookingScreen />);

    await fireEvent.press(await screen.findByLabelText('Edit Dinner settings'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(student)/default-meal/[meal]',
      params: { meal: 'DINNER' },
    });
  });
});

describe('ChangeSlotsScreen (Spec §8.3)', () => {
  it('saves all meals together and shows a summary', async () => {
    jest.mocked(getDefaultPreferences).mockResolvedValue(PREFERENCES);
    jest.mocked(saveDefaultPreferences).mockResolvedValue({
      preferences: PREFERENCES,
      changes: [
        { mealType: 'LUNCH', field: 'SLOT', from: '12:00 PM - 12:30 PM', to: '1:00 PM - 1:30 PM' },
      ],
      bookingsUpdated: 2,
    });
    await renderWithProviders(<ChangeSlotsScreen />);

    await fireEvent.press(await screen.findByLabelText('Lunch settings'));
    await fireEvent.press(screen.getByText('1:00 PM - 1:30 PM'));
    await fireEvent.press(screen.getByText('Save and Continue Default Booking'));

    await waitFor(() => expect(saveDefaultPreferences).toHaveBeenCalled());
    const body = jest.mocked(saveDefaultPreferences).mock.calls[0]?.[0];
    expect(body?.meals.find((item) => item.mealType === 'LUNCH')?.slotId).toBe(LATE);
    expect(body?.meals.find((item) => item.mealType === 'DINNER')?.slotId).toBe(EARLY);
    expect(
      await screen.findByText(/Lunch slot: 12:00 PM - 12:30 PM → 1:00 PM - 1:30 PM/),
    ).toBeTruthy();
    expect(screen.getByText('Back to Default Booking')).toBeTruthy();
  });
});
