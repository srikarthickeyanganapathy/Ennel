import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useSessionStore } from '@/shared/store/session.store';
import { routeAfterSignIn } from '../utils/route-after-sign-in';

/**
 * Sends a signed-in student on from a sign-in entry screen (Spec §3 Screens 1-2). It runs only
 * while the screen is focused: the splash stays mounted under the stack, and a redirect from
 * there would race the screen that just signed the student in (e.g. skip Account Created).
 * Running again on focus also covers Back from setup or Account Created, which would otherwise
 * show a signed-in student the splash spinner or the reference-number form.
 */
export function useSignedInRedirect(): void {
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const isOnboardingComplete = useSessionStore((state) => state.isOnboardingComplete);

  useFocusEffect(
    useCallback(() => {
      if (status === 'signedIn') router.replace(routeAfterSignIn(isOnboardingComplete));
    }, [status, isOnboardingComplete, router]),
  );
}
