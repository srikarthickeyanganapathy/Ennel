import { fireEvent, screen } from '@testing-library/react-native';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { listMeals } from '../api/onboarding-api';
import { useOnboardingDraft } from '../store/onboarding-draft.store';
import { MEALS } from './onboarding.fixtures';
import { MealPreferencesScreen } from './MealPreferencesScreen';

jest.mock('../api/onboarding-api');

describe('MealPreferencesScreen (Spec §3 Screen 7)', () => {
  beforeEach(() => {
    useOnboardingDraft.getState().reset();
    jest.mocked(listMeals).mockResolvedValue(MEALS);
  });

  it('lists slots from the API and asks for a slot when Lunch is switched on', async () => {
    await renderWithProviders(<MealPreferencesScreen />);
    await fireEvent(await screen.findByLabelText('Lunch'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Review Details' }));

    expect(await screen.findByText('Choose a slot for this meal')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('continues once each enabled meal has a slot; Breakfast needs none', async () => {
    await renderWithProviders(<MealPreferencesScreen />);
    await fireEvent(await screen.findByLabelText('Breakfast'), 'valueChange', true);
    await fireEvent(screen.getByLabelText('Lunch'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('radio', { name: '12:00 PM - 12:30 PM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Review Details' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/(onboarding)/review');
    expect(useOnboardingDraft.getState().meals.LUNCH).toMatchObject({
      isEnabled: true,
      slotId: 'l3',
    });
  });

  it('still asks for a Dinner slot when the mess has left only one (BR-ONB-4)', async () => {
    const [breakfast, lunch, dinner] = MEALS;
    const oneDinnerSlot = { ...dinner!, slots: dinner!.slots.slice(1) };
    jest.mocked(listMeals).mockResolvedValue([breakfast!, lunch!, oneDinnerSlot]);
    await renderWithProviders(<MealPreferencesScreen />);
    await fireEvent(await screen.findByLabelText('Dinner'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Review Details' }));
    expect(await screen.findByText('Choose a slot for this meal')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: '7:30 PM - 7:45 PM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Review Details' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/(onboarding)/review');
  });

  it('rejects a remembered slot that is no longer offered', async () => {
    useOnboardingDraft.getState().updateMeal('LUNCH', { isEnabled: true, slotId: 'removed' });
    await renderWithProviders(<MealPreferencesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Review Details' }));
    expect(await screen.findByText('Choose a slot for this meal')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('keeps the overall switch separate from per-meal switches (Spec §8.1)', async () => {
    await renderWithProviders(<MealPreferencesScreen />);
    await fireEvent(await screen.findByLabelText('Lunch'), 'valueChange', true);
    await fireEvent(screen.getByLabelText('Default Booking'), 'valueChange', false);

    const draft = useOnboardingDraft.getState();
    expect(draft.defaultBookingEnabled).toBe(false);
    expect(draft.meals.LUNCH.isEnabled).toBe(true);
  });
});
