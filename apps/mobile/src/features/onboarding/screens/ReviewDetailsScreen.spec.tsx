import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { completeOnboarding, getMyProfile, listHostels, listMeals } from '../api/onboarding-api';
import { useOnboardingDraft } from '../store/onboarding-draft.store';
import { BLOCK_ID, HOSTELS, MEALS, PROFILE } from './onboarding.fixtures';
import { ReviewDetailsScreen } from './ReviewDetailsScreen';

jest.mock('../api/onboarding-api');

function fillDraft(): void {
  const draft = useOnboardingDraft.getState();
  draft.reset();
  draft.prefill(PROFILE);
  draft.updateProfile({ hostelBlockId: BLOCK_ID, phone: '9876543210', parentPhone: '9876543211' });
  draft.updateMeal('LUNCH', { isEnabled: true, slotId: 'l3' });
  draft.updateMeal('DINNER', { isEnabled: true, slotId: 'd4', dietType: 'NON_VEG' });
}

describe('ReviewDetailsScreen (Spec §3 Screen 8)', () => {
  beforeEach(() => {
    jest.mocked(getMyProfile).mockResolvedValue(PROFILE);
    jest.mocked(listHostels).mockResolvedValue(HOSTELS);
    jest.mocked(listMeals).mockResolvedValue(MEALS);
    fillDraft();
  });

  it('summarizes Example A choices', async () => {
    await renderWithProviders(<ReviewDetailsScreen />);
    expect(await screen.findByText('Hostel A • Block A')).toBeTruthy();
    expect(await screen.findByText('ON • 12:00 PM - 12:30 PM • Veg')).toBeTruthy();
    expect(screen.getByText('ON • 7:30 PM - 7:45 PM • Non-Veg')).toBeTruthy();
    expect(screen.getAllByText('OFF')).toHaveLength(1);
  });

  it('saves once, even on a double tap, then opens Home', async () => {
    let resolveSave: (value: typeof PROFILE) => void = () => undefined;
    jest
      .mocked(completeOnboarding)
      .mockImplementation(() => new Promise((resolve) => (resolveSave = resolve)));
    await renderWithProviders(<ReviewDetailsScreen />);
    const save = await screen.findByRole('button', { name: 'Save & Continue' });
    await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));

    await fireEvent.press(save);
    await fireEvent.press(screen.getByRole('button', { name: 'Save & Continue' }));
    resolveSave({ ...PROFILE, isOnboardingComplete: true });

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    expect(jest.mocked(completeOnboarding).mock.calls[0]?.[0]).toMatchObject({
      profile: { hostelBlockId: BLOCK_ID, roomNumber: '323', phone: '9876543210', email: null },
      defaultBookingEnabled: true,
    });
    // College-controlled fields are not sent (ADR-0018).
    expect(jest.mocked(completeOnboarding).mock.calls[0]?.[0].profile).not.toHaveProperty(
      'fullName',
    );
  });

  it('returns to a step without clearing entries', async () => {
    await renderWithProviders(<ReviewDetailsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit Hostel & room' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(onboarding)/hostel');
    expect(useOnboardingDraft.getState().profile.phone).toBe('9876543210');
  });
});
