import { PROFILE } from '../screens/onboarding.fixtures';
import { useOnboardingDraft } from './onboarding-draft.store';

describe('onboarding draft', () => {
  beforeEach(() => useOnboardingDraft.getState().reset());

  it('keeps the student’s edits when the profile step prefills again', () => {
    const draft = useOnboardingDraft.getState();
    draft.prefill(PROFILE);
    draft.updateProfile({ phone: '9876543210' });
    draft.prefill({ ...PROFILE, phone: null });
    expect(useOnboardingDraft.getState().profile.phone).toBe('9876543210');
  });

  it('starts fresh for a different student on the same device', () => {
    const draft = useOnboardingDraft.getState();
    draft.prefill(PROFILE);
    draft.updateProfile({ phone: '9876543210' });
    draft.updateMeal('LUNCH', { isEnabled: true, slotId: 'l3' });

    draft.prefill({
      ...PROFILE,
      id: '0b9a7c1e-2f3d-4e5f-8a9b-0c1d2e3f4a5b',
      fullName: 'Another Student',
      phone: null,
    });

    const next = useOnboardingDraft.getState();
    expect(next.profile.fullName).toBe('Another Student');
    expect(next.profile.phone).toBe('');
    expect(next.meals.LUNCH.isEnabled).toBe(false);
  });
});
