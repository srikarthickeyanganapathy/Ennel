import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { createAppealRequestSchema } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { TextField } from '@/shared/components/TextField';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { formatBusinessDate } from '@/shared/utils/format-date';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import { useNoShowSummary, useReportNoShow } from '../hooks/use-no-shows';

/** Spec §7/§10 "report incorrect records or a face-verification outage". */
export function ReportNoShowScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const summary = useNoShowSummary();
  const event = summary.data?.events.find((item) => item.id === id);
  return (
    <QueryState
      isLoading={summary.isLoading}
      error={summary.error}
      onRetry={() => void summary.refetch()}
      loadingLabel="Loading this No-show"
    >
      {event ? (
        <ReportForm
          eventId={event.id}
          title={`${formatBusinessDate(event.date)} · ${MEAL_LABELS[event.mealType]}`}
          canAppeal={event.canAppeal}
        />
      ) : (
        <Screen>
          <MessageBanner message="This No-show was not found." />
        </Screen>
      )}
    </QueryState>
  );
}

function ReportForm({
  eventId,
  title,
  canAppeal,
}: {
  eventId: string;
  title: string;
  canAppeal: boolean;
}) {
  const router = useRouter();
  const report = useReportNoShow();
  const runOnce = useSubmitLock();
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const onSend = () =>
    runOnce(async () => {
      const parsed = createAppealRequestSchema.safeParse({ message });
      if (!parsed.success) {
        setProblem(parsed.error.issues[0]?.message ?? 'Tell the mess office what happened');
        return;
      }
      setProblem(null);
      await report.mutateAsync({ eventId, message: parsed.data.message });
      setIsSent(true);
    });

  return (
    <Screen
      footer={
        isSent ? (
          <AppButton label="Back" onPress={() => router.back()} />
        ) : (
          <AppButton
            label="Send Report"
            isLoading={report.isPending}
            isDisabled={!canAppeal}
            onPress={onSend}
          />
        )
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">Report incorrect record</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        {title}. If you ate this meal, or the face-verification system was not working, tell the
        mess office. The No-show keeps counting until they approve your report.
      </Text>
      {isSent ? (
        <MessageBanner
          tone="success"
          message="Report sent. You will be notified when the mess office decides."
        />
      ) : null}
      {!canAppeal && !isSent ? (
        <MessageBanner message="This record can no longer be reported." />
      ) : null}
      {report.error ? <MessageBanner message={report.error.message} /> : null}
      {isSent ? null : (
        <TextField
          label="What happened?"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          error={problem ?? undefined}
          placeholder="e.g. I ate at 1:10 PM; the camera did not recognise me."
        />
      )}
    </Screen>
  );
}
