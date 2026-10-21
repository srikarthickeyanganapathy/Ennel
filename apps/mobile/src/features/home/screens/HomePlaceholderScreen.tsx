import { Text } from 'react-native';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { useMyProfile } from '@/features/onboarding/hooks/use-onboarding-queries';
import { SlotAvailabilityCard } from '@/features/slots/components/SlotAvailabilityCard';

/** Placeholder until the Home page (Spec §4) is built in Phase 4. */
export function HomePlaceholderScreen() {
  const me = useMyProfile();
  const location = [me.data?.blockName, me.data?.roomNumber ? `Room ${me.data.roomNumber}` : null]
    .filter(Boolean)
    .join(' • ');
  return (
    <QueryState
      isLoading={me.isLoading}
      error={me.error}
      onRetry={me.refetch}
      loadingLabel="Loading"
    >
      <Screen>
        <StepHeader title={`Welcome, ${me.data?.fullName ?? ''}`} subtitle={location} />
        <Text className="text-base text-muted-foreground">
          Your setup is saved. Today&apos;s meals and booking actions will appear here.
        </Text>
        <SlotAvailabilityCard />
      </Screen>
    </QueryState>
  );
}
