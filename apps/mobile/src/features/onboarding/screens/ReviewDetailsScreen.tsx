import { type Href, useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type MealConfig } from '@ennel/shared';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import {
  useCompleteOnboarding,
  useHostels,
  useMeals,
  useMyProfile,
} from '../hooks/use-onboarding-queries';
import {
  buildOnboardingRequest,
  type MealDraft,
  useOnboardingDraft,
} from '../store/onboarding-draft.store';
import { isSlotAutoFilled } from '../utils/meal-slot-choice';

interface SectionProps {
  title: string;
  editPath: Href;
  children: ReactNode;
}

function Section({ title, editPath, children }: SectionProps) {
  const router = useRouter();
  return (
    <View className="mb-4 rounded-lg border border-border p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text accessibilityRole="header" className="text-base font-semibold text-foreground">
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}
          // Back to the existing step, so the stack does not grow with every edit.
          onPress={() => router.dismissTo(editPath)}
          className="px-2 py-1"
        >
          <Text className="font-semibold text-primary">Edit</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="ml-4 flex-1 text-right text-sm text-foreground">{value}</Text>
    </View>
  );
}

function describeMeal(meal: MealConfig, draft: MealDraft): string {
  if (!draft.isEnabled) return 'OFF';
  const diet = draft.dietType === 'VEG' ? 'Veg' : 'Non-Veg';
  const chosen = meal.slots.find((candidate) => candidate.id === draft.slotId);
  const slot = chosen ?? (isSlotAutoFilled(meal) ? meal.slots[0] : undefined);
  return `ON • ${slot?.label ?? 'No slot chosen'} • ${diet}`;
}

/** Spec §3 Screen 8: review, edit without losing entries, then save everything at once. */
export function ReviewDetailsScreen() {
  const router = useRouter();
  const draft = useOnboardingDraft();
  const me = useMyProfile();
  const hostels = useHostels();
  const meals = useMeals();
  const save = useCompleteOnboarding();
  const lock = useSubmitLock();

  const block = (hostels.data ?? [])
    .flatMap((hostel) => hostel.blocks.map((item) => ({ ...item, hostelName: hostel.name })))
    .find((item) => item.id === draft.profile.hostelBlockId);

  const onSave = () =>
    lock(async () => {
      await save.mutateAsync(buildOnboardingRequest(draft, me.data?.editableFields ?? []));
      draft.reset();
      router.replace('/(tabs)');
    });

  const issues = save.error?.fieldIssues.map((issue) => issue.message).join(' ');
  return (
    <Screen
      footer={
        <AppButton
          label="Save & Continue"
          onPress={onSave}
          isLoading={save.isPending}
          isDisabled={!me.data}
        />
      }
    >
      <StepHeader step="Step 4 of 4" title="Review your details" />
      {save.error ? <MessageBanner message={issues || save.error.message} /> : null}
      <Section title="Profile" editPath="/(onboarding)/profile">
        <Row label="Name" value={draft.profile.fullName} />
        <Row label="Department" value={draft.profile.department} />
        <Row label="Year" value={draft.profile.academicYear} />
        <Row label="Email" value={draft.profile.email || 'Not added'} />
      </Section>
      <Section title="Hostel & room" editPath="/(onboarding)/hostel">
        <Row label="Hostel" value={block ? `${block.hostelName} • ${block.name}` : 'Not chosen'} />
        <Row label="Room" value={draft.profile.roomNumber} />
        <Row label="Your phone" value={draft.profile.phone} />
        <Row label="Parent's phone" value={draft.profile.parentPhone} />
      </Section>
      <Section title="Meal preferences" editPath="/(onboarding)/meal-preferences">
        <Row label="Default Booking" value={draft.defaultBookingEnabled ? 'ON' : 'OFF'} />
        {(meals.data ?? []).map((meal) => (
          <Row
            key={meal.id}
            label={meal.displayName}
            value={describeMeal(meal, draft.meals[meal.mealType])}
          />
        ))}
      </Section>
    </Screen>
  );
}
