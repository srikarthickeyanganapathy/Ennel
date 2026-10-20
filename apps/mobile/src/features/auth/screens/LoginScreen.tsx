import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { loginRequestSchema } from '@ennel/shared';
import { type z } from 'zod';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { TextField } from '@/shared/components/TextField';
import { useLogin } from '../hooks/use-auth-mutations';
import { routeAfterSignIn } from '../utils/route-after-sign-in';

type FormInput = z.input<typeof loginRequestSchema>;
type FormOutput = z.output<typeof loginRequestSchema>;

/** Spec §3 Screen 2: an already-registered number goes to normal login. */
export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ referenceNumber?: string; isExisting?: string }>();
  const login = useLogin();
  const lock = useSubmitLock();
  const { control, handleSubmit, formState, getValues } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { referenceNumber: params.referenceNumber ?? '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    const session = await login.mutateAsync(values);
    router.replace(routeAfterSignIn(session.isOnboardingComplete));
  });
  const onSubmit = () => lock(submit);

  return (
    <Screen footer={<AppButton label="Log In" onPress={onSubmit} isLoading={login.isPending} />}>
      <StepHeader title="Log in" />
      {params.isExisting === 'true' && !login.error ? (
        <MessageBanner
          tone="info"
          message="You already have an account. Log in with your password."
        />
      ) : null}
      {login.error ? <MessageBanner message={login.error.message} /> : null}
      <Controller
        control={control}
        name="referenceNumber"
        render={({ field }) => (
          <TextField
            label="Reference number"
            keyboardType="number-pad"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.referenceNumber?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
            isPassword
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={onSubmit}
            error={formState.errors.password?.message}
          />
        )}
      />
      <Text className="text-sm text-muted-foreground">
        Forgot your password? Ask the mess office for a reset code.
      </Text>
      <AppButton
        label="I Have a Reset Code"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: '/(auth)/reset-with-code',
            params: { referenceNumber: getValues('referenceNumber') },
          })
        }
      />
    </Screen>
  );
}
