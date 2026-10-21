import { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useOnboardingDraft } from '@/features/onboarding/store/onboarding-draft.store';
import { useSessionStore } from '@/shared/store/session.store';
import { useClearDataOnSignOut } from './use-clear-data-on-sign-out';

describe('useClearDataOnSignOut', () => {
  it('clears cached data and the setup draft when the session ends on its own', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['me'], { fullName: 'Previous Student' });
    useOnboardingDraft.getState().updateProfile({ phone: '9876543210' });
    useSessionStore.setState({ status: 'signedIn', accessToken: 'token' });
    await renderHook(() => useClearDataOnSignOut(queryClient));
    expect(queryClient.getQueryData(['me'])).toBeDefined();

    // e.g. the refresh token was revoked, so the API client signed the student out.
    await act(async () => useSessionStore.setState({ status: 'signedOut', accessToken: null }));

    expect(queryClient.getQueryData(['me'])).toBeUndefined();
    expect(useOnboardingDraft.getState().profile.phone).toBe('');
  });
});
