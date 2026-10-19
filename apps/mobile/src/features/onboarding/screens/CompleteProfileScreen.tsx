import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { type StudentProfileField } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { TextField } from '@/shared/components/TextField';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { useMyProfile } from '../hooks/use-onboarding-queries';
import { useOnboardingDraft } from '../store/onboarding-draft.store';
import { type FieldErrors, validateProfileFields } from '../utils/validate-profile-fields';

const COLLEGE_HINT = 'Managed by your college';

/** Spec §3 Screen 5: prefilled college data; only permitted fields are editable. */
export function CompleteProfileScreen() {
  const router = useRouter();
  const me = useMyProfile();
  const { profile: draft, prefill, updateProfile } = useOnboardingDraft();
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (me.data) prefill(me.data);
  }, [me.data, prefill]);

  const editable = new Set<StudentProfileField>(me.data?.editableFields ?? []);
  const isLocked = (field: StudentProfileField) => !editable.has(field);

  const onContinue = () => {
    const fields: StudentProfileField[] = ['fullName', 'department', 'academicYear', 'email'];
    const found = validateProfileFields(
      draft,
      fields.filter((field) => editable.has(field)),
      ['email'],
    );
    setErrors(found);
    if (Object.keys(found).length === 0) router.push('/(onboarding)/hostel');
  };

  return (
    <QueryState
      isLoading={me.isLoading}
      error={me.error}
      onRetry={me.refetch}
      loadingLabel="Loading your details"
    >
      <Screen footer={<AppButton label="Continue" onPress={onContinue} />}>
        <StepHeader
          step="Step 1 of 4"
          title="Complete your profile"
          subtitle={`Reference number ${me.data?.referenceNumber ?? ''}`}
        />
        <ProfilePhotoPicker photoUrl={me.data?.photoUrl ?? null} />
        <TextField
          label="Full name"
          value={draft.fullName}
          onChangeText={(fullName) => updateProfile({ fullName })}
          isReadOnly={isLocked('fullName')}
          hint={isLocked('fullName') ? COLLEGE_HINT : undefined}
          error={errors.fullName}
        />
        <TextField
          label="Department"
          value={draft.department}
          onChangeText={(department) => updateProfile({ department })}
          isReadOnly={isLocked('department')}
          hint={isLocked('department') ? COLLEGE_HINT : undefined}
          error={errors.department}
        />
        <TextField
          label="Academic year"
          keyboardType="number-pad"
          value={draft.academicYear}
          onChangeText={(academicYear) => updateProfile({ academicYear })}
          isReadOnly={isLocked('academicYear')}
          hint={isLocked('academicYear') ? COLLEGE_HINT : undefined}
          error={errors.academicYear}
        />
        <TextField
          label="Email address (optional)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={draft.email}
          onChangeText={(email) => updateProfile({ email })}
          isReadOnly={isLocked('email')}
          error={errors.email}
        />
      </Screen>
    </QueryState>
  );
}
