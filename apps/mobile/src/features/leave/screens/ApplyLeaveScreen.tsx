import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  addBusinessDays,
  type ApplyLeaveRequest,
  type BusinessDate,
  LEAVE_MAX_DAYS,
  type MealPoint,
  type MealType,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { TextField } from '@/shared/components/TextField';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { confirmAction } from '@/shared/utils/confirm-action';
import { MealPointPicker } from '../components/MealPointPicker';
import { useApplyLeave, useLeavePreview, useLeaves } from '../hooks/use-leaves';
import { describeCount, describePoint } from '../utils/leave-text';

/** Spec §11.1 Apply for Leave, with the live summary and a final confirmation. */
export function ApplyLeaveScreen() {
  const leaves = useLeaves();
  return (
    <QueryState
      isLoading={leaves.isLoading}
      error={leaves.error}
      onRetry={() => void leaves.refetch()}
      loadingLabel="Loading leave dates"
    >
      {leaves.data ? <ApplyForm earliest={leaves.data.earliestStart} /> : null}
    </QueryState>
  );
}

function ApplyForm({ earliest }: { earliest: MealPoint }) {
  const router = useRouter();
  const apply = useApplyLeave();
  const runOnce = useSubmitLock();
  const [start, setStart] = useState<{ date: BusinessDate; mealType: MealType }>(earliest);
  const [end, setEnd] = useState<{ date: BusinessDate | null; mealType: MealType }>({
    date: null,
    mealType: 'DINNER',
  });
  const [reason, setReason] = useState('');
  const request: ApplyLeaveRequest | null = end.date
    ? {
        startDate: start.date,
        startMealType: start.mealType,
        endDate: end.date,
        endMealType: end.mealType,
        reason: reason.trim() || undefined,
      }
    : null;
  const preview = useLeavePreview(request && { ...request, reason: undefined });
  const summary = preview.data;
  const lastDate = addBusinessDays(earliest.date, LEAVE_MAX_DAYS);

  const onApply = () =>
    runOnce(async () => {
      if (!request || !summary || summary.problem) return;
      const isConfirmed = await confirmAction({
        title: 'Apply for leave?',
        message: [
          `${describePoint(start)} → ${describePoint({ date: request.endDate, mealType: request.endMealType })}`,
          describeCount(summary.days, summary.meals),
          summary.status === 'PENDING'
            ? 'This needs approval. Your meals stay booked until it is approved.'
            : `It starts right away; ${summary.bookingsToPause} booked meals will be paused.`,
        ].join('\n'),
        cancelLabel: 'Go Back',
        confirmLabel: 'Apply Leave',
      });
      if (!isConfirmed) return;
      const result = await apply.mutateAsync(request);
      router.replace({ pathname: '/(student)/leave/[id]', params: { id: result.leave.id } });
    });

  return (
    <Screen
      footer={
        <View className="gap-3">
          <AppButton
            label="Apply Leave"
            isLoading={apply.isPending}
            isDisabled={!summary || summary.problem !== null}
            onPress={onApply}
          />
          <AppButton label="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">Apply for Leave</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        The earliest you can start is {describePoint(earliest)}.
      </Text>
      <MealPointPicker
        dateLabel="From Date"
        mealLabel="From Meal"
        date={start.date}
        mealType={start.mealType}
        bounds={{ firstDate: earliest.date, lastDate, today: earliest.date }}
        onChange={(change) => setStart((current) => ({ ...current, ...change }))}
      />
      <MealPointPicker
        dateLabel="To Date"
        mealLabel="To Meal"
        date={end.date}
        mealType={end.mealType}
        bounds={{ firstDate: start.date, lastDate, today: earliest.date }}
        onChange={(change) => setEnd((current) => ({ ...current, ...change }))}
      />
      <TextField
        label="Reason (optional)"
        value={reason}
        maxLength={300}
        onChangeText={setReason}
        placeholder="e.g. Going home for the festival"
      />
      <View
        accessibilityLiveRegion="polite"
        className="rounded-lg border border-border bg-surface p-4"
      >
        <Text className="mb-1 text-sm font-semibold text-foreground">Leave Summary</Text>
        {!request ? (
          <Text className="text-sm text-muted-foreground">Choose the To Date.</Text>
        ) : null}
        {preview.isLoading ? (
          <Text className="text-sm text-muted-foreground">Checking…</Text>
        ) : null}
        {summary?.problem ? <MessageBanner message={summary.problem} /> : null}
        {summary && !summary.problem ? (
          <View>
            <Text className="text-sm text-foreground">
              {describeCount(summary.days, summary.meals)}
            </Text>
            <Text className="text-sm text-foreground">
              {summary.status === 'PENDING'
                ? 'Needs approval before meals are paused.'
                : `Starts right away. ${summary.bookingsToPause} booked meals will be paused.`}
            </Text>
          </View>
        ) : null}
      </View>
      {apply.error ? (
        <View className="mt-4">
          <MessageBanner message={apply.error.message} />
        </View>
      ) : null}
    </Screen>
  );
}
