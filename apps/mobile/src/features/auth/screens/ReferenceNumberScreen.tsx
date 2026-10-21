import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { RosterCheckStatus, rosterCheckRequestSchema } from '@ennel/shared';
import { type z } from 'zod';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { TextField } from '@/shared/components/TextField';
import { useRosterCheck } from '../hooks/use-auth-mutations';
import { useSignedInRedirect } from '../hooks/use-signed-in-redirect';

type FormInput = z.input<typeof rosterCheckRequestSchema>;
type FormOutput = z.output<typeof rosterCheckRequestSchema>;

/** Spec §3 Screen 2: the number is checked against the college roster by the API. */
export function ReferenceNumberScreen() {
  const router = useRouter();
  const rosterCheck = useRosterCheck();
  const lock = useSubmitLock();
  useSignedInRedirect();
  const { control, handleSubmit, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(rosterCheckRequestSchema),
    defaultValues: { referenceNumber: '' },
  });

  const submit = handleSubmit(async ({ referenceNumber }) => {
    const { status } = await rosterCheck.mutateAsync({ referenceNumber });
    const pathname = status === RosterCheckStatus.NEW ? '/(auth)/create-password' : '/(auth)/login';
    router.push({
      pathname,
      params: { referenceNumber, isExisting: String(status === 'REGISTERED') },
    });
  });
  const onSubmit = () => lock(submit);

  const error = rosterCheck.error;
  return (
    <Screen
      footer={<AppButton label="Continue" onPress={onSubmit} isLoading={rosterCheck.isPending} />}
    >
      <StepHeader
        title="Enter your reference number"
        subtitle="Use the reference number issued by your college."
      />
      {error ? <MessageBanner message={error.message} /> : null}
      <Controller
        control={control}
        name="referenceNumber"
        render={({ field }) => (
          <TextField
            label="Reference number"
            placeholder="e.g. 24 900 417"
            keyboardType="number-pad"
            autoComplete="off"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={onSubmit}
            error={formState.errors.referenceNumber?.message}
          />
        )}
      />
      <Text className="text-sm text-muted-foreground">
        If your reference number is not accepted, contact the mess office.
      </Text>
    </Screen>
  );
}
