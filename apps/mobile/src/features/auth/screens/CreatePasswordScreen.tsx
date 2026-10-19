import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { STUDENT_PASSWORD_MIN_LENGTH, registerRequestSchema } from '@ennel/shared';
import { type z } from 'zod';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { TextField } from '@/shared/components/TextField';
import { useRegister } from '../hooks/use-auth-mutations';

type FormInput = z.input<typeof registerRequestSchema>;
type FormOutput = z.output<typeof registerRequestSchema>;

/** Spec §3 Screen 3. The same schema runs on the server, which stores only an argon2 hash. */
export function CreatePasswordScreen() {
  const router = useRouter();
  const { referenceNumber = '' } = useLocalSearchParams<{ referenceNumber?: string }>();
  const register = useRegister();
  const lock = useSubmitLock();
  const { control, handleSubmit, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { referenceNumber, password: '', confirmPassword: '' },
  });

  const submit = handleSubmit(async (values) => {
    await register.mutateAsync(values);
    router.replace('/(auth)/account-created');
  });
  const onSubmit = () => lock(submit);

  return (
    <Screen
      footer={
        <AppButton label="Create Account" onPress={onSubmit} isLoading={register.isPending} />
      }
    >
      <StepHeader title="Create your password" subtitle={`Reference number ${referenceNumber}`} />
      {register.error ? <MessageBanner message={register.error.message} /> : null}
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="New password"
            isPassword
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            hint={`At least ${STUDENT_PASSWORD_MIN_LENGTH} characters`}
            error={formState.errors.password?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <TextField
            label="Confirm password"
            isPassword
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={onSubmit}
            error={formState.errors.confirmPassword?.message}
          />
        )}
      />
      <Text className="text-sm text-muted-foreground">
        Your password is stored securely and never shown to staff.
      </Text>
    </Screen>
  );
}
