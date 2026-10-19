import { useEffect } from 'react';
import { refreshSessionOnce } from '@/shared/api-client/api-client';
import { useSessionStore } from '@/shared/store/session.store';

/** Spec §3 Screen 1: "a short loading state may appear while the app checks the session". */
export function useRestoreSession(): void {
  const status = useSessionStore((state) => state.status);

  useEffect(() => {
    if (status !== 'restoring') return;
    refreshSessionOnce()
      .then((isRestored) => {
        if (!isRestored) useSessionStore.setState({ status: 'signedOut' });
      })
      // Offline at launch: show the sign-in entry rather than a stuck splash.
      .catch(() => useSessionStore.setState({ status: 'signedOut' }));
  }, [status]);
}
