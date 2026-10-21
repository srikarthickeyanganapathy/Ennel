import { type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useOnboardingDraft } from '@/features/onboarding/store/onboarding-draft.store';
import { useSessionStore } from '@/shared/store/session.store';

/**
 * Drops the previous student's cached data on every sign-out, including one caused by an
 * expired or revoked session (not only the Logout button), so the next student to sign in
 * on this device never sees it, even briefly.
 */
export function useClearDataOnSignOut(queryClient: QueryClient): void {
  const status = useSessionStore((state) => state.status);
  useEffect(() => {
    if (status !== 'signedOut') return;
    queryClient.clear();
    useOnboardingDraft.getState().reset();
  }, [status, queryClient]);
}
