import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { type SlotAvailabilityResponse } from '@ennel/shared';
import { ApiError } from '@/shared/api-client/api-error';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { bookMeal, changeBooking } from '@/features/bookings/api/bookings-api';
import { getSlotAvailability } from '../api/slots-api';
import { SlotSelectionScreen } from './SlotSelectionScreen';

jest.mock('../api/slots-api');
jest.mock('@/features/bookings/api/bookings-api');
const mockedGet = jest.mocked(getSlotAvailability);

const BASE: SlotAvailabilityResponse = {
  date: '2026-10-22',
  mealType: 'LUNCH',
  mealName: 'Lunch',
  serviceStartMinute: 660,
  serviceEndMinute: 810,
  isClosed: false,
  closureTitle: null,
  allowOverCapacityBooking: false,
  lastBookableDate: '2026-10-28',
  generatedAt: '2026-10-21T05:30:00.000Z',
  slots: [
    {
      slotId: '7b7f3c1e-1d2a-4c55-9f3e-2b1a0c9d8e71',
      label: '11:00 AM - 11:30 AM',
      startMinute: 660,
      endMinute: 690,
      officialCapacity: 500,
      bookedCount: 500,
      overCapacityCount: 0,
      occupancyPct: 100,
      status: 'FULL',
      isRecommended: false,
      canSelect: false,
      unavailableReason: 'FULL',
    },
    {
      slotId: '0c2d4e6f-8a9b-4c1d-9e2f-3a4b5c6d7e8f',
      label: '11:30 AM - 12:00 PM',
      startMinute: 690,
      endMinute: 720,
      officialCapacity: 500,
      bookedCount: 120,
      overCapacityCount: 0,
      occupancyPct: 24,
      status: 'AVAILABLE',
      isRecommended: true,
      canSelect: true,
      unavailableReason: null,
    },
  ],
};

describe('SlotSelectionScreen (Spec §5)', () => {
  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-10-22', meal: 'LUNCH' });
  });

  it('shows each slot with a text label, counts and the Recommended flag', async () => {
    mockedGet.mockResolvedValue(BASE);
    await renderWithProviders(<SlotSelectionScreen />);

    expect(await screen.findByText('Lunch slots')).toBeTruthy();
    expect(screen.getByText('Tomorrow, Thu, 22 Oct')).toBeTruthy();
    expect(screen.getByText('Full')).toBeTruthy();
    expect(screen.getByText('This slot is full.')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText(/120 \/ 500 booked · 24% full/)).toBeTruthy();
    expect(mockedGet).toHaveBeenCalledWith({ date: '2026-10-22', meal: 'LUNCH' });
  });

  it('explains a closed meal and over-capacity acceptance (Spec §5.2)', async () => {
    const [full, open] = BASE.slots;
    if (!full || !open) throw new Error('fixture');
    mockedGet.mockResolvedValue({
      ...BASE,
      allowOverCapacityBooking: true,
      isClosed: true,
      closureTitle: 'Festival',
      slots: [
        {
          ...full,
          status: 'OVER_CAPACITY',
          bookedCount: 507,
          overCapacityCount: 7,
          canSelect: true,
          unavailableReason: null,
        },
      ],
    });
    await renderWithProviders(<SlotSelectionScreen />);

    expect(await screen.findByText(/closed for lunch on this day: Festival/)).toBeTruthy();
    expect(screen.getByText('Over Capacity')).toBeTruthy();
    expect(screen.getByText(/507 \/ 500 booked · 100% full · \+7 over capacity/)).toBeTruthy();
    expect(
      screen.getByText(/additional bookings are being accepted under the mess policy/),
    ).toBeTruthy();
  });

  it('shows the server message when the date is outside the booking horizon', async () => {
    mockedGet.mockRejectedValue(
      new ApiError('BOOKING_NOT_ALLOWED', 'Choose a date from today up to 2026-10-28.', 422),
    );
    await renderWithProviders(<SlotSelectionScreen />);
    expect(await screen.findByText(/Choose a date from today up to 2026-10-28./)).toBeTruthy();
  });

  it('refuses a broken link without calling the API', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: 'tomorrow', meal: 'LUNCH' });
    await renderWithProviders(<SlotSelectionScreen />);
    expect(screen.getByText(/could not be opened/)).toBeTruthy();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('books the chosen slot and meal type, then goes back (Spec §5.1)', async () => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ date: '2026-10-22', meal: 'LUNCH', mode: 'book' });
    mockedGet.mockResolvedValue(BASE);
    jest.mocked(bookMeal).mockResolvedValue({} as never);
    await renderWithProviders(<SlotSelectionScreen />);

    const confirm = await screen.findByRole('button', { name: 'Confirm Slot' });
    expect(confirm.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('radio', { name: /11:30 AM - 12:00 PM/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Non-Veg' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm Slot' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(jest.mocked(bookMeal).mock.calls[0]?.[0]).toEqual({
      date: '2026-10-22',
      mealType: 'LUNCH',
      slotId: '0c2d4e6f-8a9b-4c1d-9e2f-3a4b5c6d7e8f',
      dietType: 'NON_VEG',
    });
  });

  it('does not let a full slot be chosen', async () => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ date: '2026-10-22', meal: 'LUNCH', mode: 'book' });
    mockedGet.mockResolvedValue(BASE);
    await renderWithProviders(<SlotSelectionScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: /11:00 AM - 11:30 AM/ }));
    const confirm = screen.getByRole('button', { name: 'Confirm Slot' });
    expect(confirm.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('changes only what was changed, with the booking version', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({
      date: '2026-10-22',
      meal: 'LUNCH',
      mode: 'change',
      bookingId: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      version: '2',
      slotId: '0c2d4e6f-8a9b-4c1d-9e2f-3a4b5c6d7e8f',
      dietType: 'VEG',
    });
    mockedGet.mockResolvedValue(BASE);
    jest.mocked(changeBooking).mockResolvedValue({} as never);
    await renderWithProviders(<SlotSelectionScreen />);

    const save = await screen.findByRole('button', { name: 'Save Changes' });
    expect(save.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'Non-Veg' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(changeBooking).toHaveBeenCalled());
    expect(jest.mocked(changeBooking).mock.calls[0]?.slice(0, 2)).toEqual([
      '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      { version: 2, dietType: 'NON_VEG' },
    ]);
  });
});
