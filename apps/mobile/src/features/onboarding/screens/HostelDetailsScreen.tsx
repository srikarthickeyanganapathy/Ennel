import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AppButton } from '@/shared/components/AppButton';
import { OptionList } from '@/shared/components/OptionList';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { TextField } from '@/shared/components/TextField';
import { useHostels } from '../hooks/use-onboarding-queries';
import { useOnboardingDraft } from '../store/onboarding-draft.store';
import { type FieldErrors, validateProfileFields } from '../utils/validate-profile-fields';

/** Spec §3 Screen 6: hostel block from valid options, room and contact numbers. */
export function HostelDetailsScreen() {
  const router = useRouter();
  const hostels = useHostels();
  const { profile: draft, updateProfile } = useOnboardingDraft();
  const [errors, setErrors] = useState<FieldErrors>({});

  const blockOptions = (hostels.data ?? []).flatMap((hostel) =>
    hostel.blocks.map((block) => ({ value: block.id, label: `${hostel.name} • ${block.name}` })),
  );

  const onContinue = () => {
    const found = validateProfileFields(draft, [
      'hostelBlockId',
      'roomNumber',
      'phone',
      'parentPhone',
    ]);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push('/(onboarding)/meal-preferences');
  };

  return (
    <QueryState
      isLoading={hostels.isLoading}
      error={hostels.error}
      onRetry={hostels.refetch}
      loadingLabel="Loading hostels"
    >
      <Screen footer={<AppButton label="Continue" onPress={onContinue} />}>
        <StepHeader step="Step 2 of 4" title="Hostel & room details" />
        <OptionList
          label="Hostel and block"
          options={blockOptions}
          selected={draft.hostelBlockId}
          onSelect={(hostelBlockId) => updateProfile({ hostelBlockId })}
          error={errors.hostelBlockId}
        />
        <TextField
          label="Room number"
          value={draft.roomNumber}
          onChangeText={(roomNumber) => updateProfile({ roomNumber })}
          error={errors.roomNumber}
        />
        <TextField
          label="Your contact number"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={draft.phone}
          onChangeText={(phone) => updateProfile({ phone })}
          error={errors.phone}
        />
        <TextField
          label="Parent's contact number"
          keyboardType="phone-pad"
          value={draft.parentPhone}
          onChangeText={(parentPhone) => updateProfile({ parentPhone })}
          error={errors.parentPhone}
        />
      </Screen>
    </QueryState>
  );
}
