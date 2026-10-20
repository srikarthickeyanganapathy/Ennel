import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { STUDENT_PASSWORD_MIN_LENGTH, resetWithCodeRequestSchema } from '@ennel/shared';
import { type z } from 'zod';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { TextField } from '@/shared/components/TextField';
import { useResetWithCode } from '../hooks/use-auth-mutations';
import { routeAfterSignIn } from '../utils/route-after-sign-in';

type FormInput = z.input<typeof resetWithCodeRequestSchema>;
type FormOutput = z.output<typeof resetWithCodeRequestSchema>;
type FieldName = keyof FormInput;

const FIELDS: { name: FieldName; label: string; isPassword?: boolean }[] = [
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'code', label: 'Reset code' },
  { name: 'password', label: 'New password', isPassword: true },
  { name: 'confirmPassword', label: 'Confirm password', isPassword: true },
];

/**
 * Credential reset without email or SMS (ADR-0019, BR-AUTH-6): the mess office gives the
 * student a one-time code, and the student sets a new password with it.
 */
export function ResetWithCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ referenceNumber?: string }>();
  const reset = useResetWithCode();
  const lock = useSubmitLock();
  const { control, handleSubmit, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(resetWithCodeRequestSchema),
    defaultValues: {
      referenceNumber: params.referenceNumber ?? '',
      code: '',
      password: '',
      confirmPassword: '',
    },
  });

  const submit = handleSubmit(async (values) => {
    const session = await reset.mutateAsync(values);
    router.replace(routeAfterSignIn(session.isOnboardingComplete));
  });
  const onSubmit = () => lock(submit);

  return (
    <Screen
      footer={<AppButton label="Set New Password" onPress={onSubmit} isLoading={reset.isPending} />}
    >
      <StepHeader
        title="Use a reset code"
        subtitle="Enter the code you received from the mess office."
      />
      {reset.error ? <MessageBanner message={reset.error.message} /> : null}
      {FIELDS.map(({ name, label, isPassword }) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field }) => (
            <TextField
              label={label}
              isPassword={isPassword}
              keyboardType={name === 'referenceNumber' ? 'number-pad' : 'default'}
              autoCapitalize={name === 'code' ? 'characters' : 'none'}
              autoComplete={isPassword ? 'new-password' : 'off'}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              onSubmitEditing={name === 'confirmPassword' ? onSubmit : undefined}
              hint={
                name === 'password'
                  ? `At least ${STUDENT_PASSWORD_MIN_LENGTH} characters`
                  : undefined
              }
              error={formState.errors[name]?.message}
            />
          )}
        />
      ))}
      <Text className="text-sm text-muted-foreground">
        A code works once and expires after 24 hours. Setting a new password signs you out on other
        devices.
      </Text>
    </Screen>
  );
}
