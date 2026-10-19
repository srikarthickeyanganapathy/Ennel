/** Spec §3 Screen 4: first-time users finish setup before Home. */
export function routeAfterSignIn(
  isOnboardingComplete: boolean,
): '/(tabs)' | '/(onboarding)/profile' {
  return isOnboardingComplete ? '/(tabs)' : '/(onboarding)/profile';
}
