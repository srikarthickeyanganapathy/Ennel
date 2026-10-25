import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { type DefaultMealSettings, type DefaultPreferences, type WeekdayRule } from '@ennel/shared';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { confirmAction } from '@/shared/utils/confirm-action';
import { getDefaultPreferences } from '@/features/default-booking/api/default-booking-api';
import { createWeekdayRules, deleteWeekdayRule, listWeekdayRules } from '../api/weekday-rules-api';
import { PlanAheadScreen } from './PlanAheadScreen';
import { WeekdayRuleEditorScreen } from './WeekdayRuleEditorScreen';

jest.mock('../api/weekday-rules-api');
jest.mock('@/features/default-booking/api/default-booking-api');
jest.mock('@/shared/utils/confirm-action');

const EARLY = '11111111-1111-4111-8111-111111111111';
const LATE = '22222222-2222-4222-8222-222222222222';
const RULE_ID = '33333333-3333-4333-8333-333333333333';

const lunch: DefaultMealSettings = {
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
  nextDateStatus: 'AVAILABLE',
};
const PREFERENCES: DefaultPreferences = {
  defaultBookingEnabled: true,
  fallbackPolicy: 'ASK_STUDENT',
  meals: [lunch],
};
const RULE: WeekdayRule = {
  id: RULE_ID,
  mealType: 'LUNCH',
  mealName: 'Lunch',
  weekdays: [1, 3],
  slotId: LATE,
  slotLabel: '1:00 PM - 1:30 PM',
  dietType: 'NON_VEG',
  version: 2,
  pausedReason: 'DEFAULT_BOOKING_OFF',
};

beforeEach(() => {
  jest.mocked(getDefaultPreferences).mockResolvedValue(PREFERENCES);
  jest.mocked(listWeekdayRules).mockResolvedValue([RULE]);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe('PlanAheadScreen (Spec §6)', () => {
  it('lists saved rules, says when one is paused, and opens a date', async () => {
    await renderWithProviders(<PlanAheadScreen />);

    expect(await screen.findByText('Lunch on Mon, Wed · 1:00 PM - 1:30 PM · Non-Veg')).toBeTruthy();
    expect(screen.getByText('Paused while Default Booking is OFF.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tomorrow'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(student)/plan-ahead/day' }),
    );
  });
});

describe('WeekdayRuleEditorScreen (Spec §6.2)', () => {
  it('asks for a day first, then saves the chosen days, meal and slot', async () => {
    jest.mocked(createWeekdayRules).mockResolvedValue({ items: [RULE], bookingsUpdated: 3 });
    await renderWithProviders(<WeekdayRuleEditorScreen />);

    await fireEvent.press(await screen.findByText('Save Rule'));
    expect(screen.getByText('Choose at least one day.', { exact: false })).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Monday'));
    await fireEvent.press(screen.getByLabelText('Friday'));
    await fireEvent.press(screen.getByLabelText('Include Lunch'));
    await fireEvent.press(screen.getByText('1:00 PM - 1:30 PM'));
    await fireEvent.press(screen.getByText('Save Rule'));

    await waitFor(() =>
      expect(createWeekdayRules).toHaveBeenCalledWith({
        weekdays: [1, 5],
        meals: [{ mealType: 'LUNCH', slotId: LATE, dietType: 'VEG' }],
      }),
    );
    expect(await screen.findByText(/3 upcoming bookings were updated/)).toBeTruthy();
  });

  it('deletes a rule only after confirmation, sending the version shown', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: RULE_ID });
    jest.mocked(confirmAction).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    jest.mocked(deleteWeekdayRule).mockResolvedValue({ items: [], bookingsUpdated: 2 });
    await renderWithProviders(<WeekdayRuleEditorScreen />);

    await fireEvent.press(await screen.findByText('Delete Rule'));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
    expect(deleteWeekdayRule).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Delete Rule'));
    await waitFor(() => expect(deleteWeekdayRule).toHaveBeenCalledWith(RULE_ID, 2));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
