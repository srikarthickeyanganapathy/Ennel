import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  addBusinessDays,
  comparePoints,
  type Leave,
  LEAVE_MAX_DAYS,
  type LeaveResult,
  type MealPoint,
  type MealType,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { confirmAction } from '@/shared/utils/confirm-action';
import { MealPointPicker } from '../components/MealPointPicker';
import { useEndLeave, useExtendLeave, useLeave, useLeaves } from '../hooks/use-leaves';
import {
  describeCount,
  describePoint,
  describeRange,
  LEAVE_STATE_DISPLAY,
} from '../utils/leave-text';

/** Spec §11.2: one leave, with Extend Leave and End Leave / Resume Meals. */
export function LeaveDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const leave = useLeave(id);
  const leaves = useLeaves();
  return (
    <QueryState
      isLoading={leave.isLoading || leaves.isLoading}
      error={leave.error ?? leaves.error}
      onRetry={() => void (leave.refetch(), leaves.refetch())}
      loadingLabel="Loading this leave"
    >
      {leave.data && leaves.data ? (
        <LeaveDetails leave={leave.data} earliest={leaves.data.earliestStart} />
      ) : null}
    </QueryState>
  );
}

function resultText(result: LeaveResult): string {
  if (result.extensionRequest) return 'The extra days were sent for approval.';
  if (result.leave.status === 'CANCELLED')
    return `Leave cancelled. ${result.bookingsResumed} meals booked again.`;
  return `Saved. ${result.bookingsPaused} meals paused, ${result.bookingsResumed} booked again.`;
}

function LeaveDetails({ leave, earliest }: { leave: Leave; earliest: MealPoint }) {
  const display = LEAVE_STATE_DISPLAY[leave.state];
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Screen>
      <Text className="text-sm font-medium text-muted-foreground">Leave Management</Text>
      <Text className="mb-2 text-xl font-bold text-foreground" accessibilityRole="header">
        {describeRange(leave)}
      </Text>
      <Text
        className={`mb-3 self-start rounded px-2 py-1 text-sm font-semibold ${display.badgeClassName}`}
      >
        {display.text}
      </Text>
      <Text className="text-sm text-foreground">{describeCount(leave.days, leave.meals)}</Text>
      {leave.reason ? (
        <Text className="mt-1 text-sm text-muted-foreground">Reason: {leave.reason}</Text>
      ) : null}
      {leave.isCreatedByStaff ? (
        <Text className="mt-1 text-sm text-muted-foreground">Added by mess staff.</Text>
      ) : null}
      {leave.rejectionReason ? (
        <View className="mt-3">
          <MessageBanner message={`Not approved: ${leave.rejectionReason}`} />
        </View>
      ) : null}
      {notice ? (
        <View className="mt-3">
          <MessageBanner tone="success" message={notice} />
        </View>
      ) : null}
      {leave.canChange ? (
        <View className="mt-4">
          <ExtendSection leave={leave} onDone={(result) => setNotice(resultText(result))} />
          <EndSection
            leave={leave}
            earliest={earliest}
            onDone={(result) => setNotice(resultText(result))}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function ExtendSection({ leave, onDone }: { leave: Leave; onDone: (result: LeaveResult) => void }) {
  const extend = useExtendLeave();
  const runOnce = useSubmitLock();
  const [end, setEnd] = useState<{ date: string | null; mealType: MealType }>({
    date: null,
    mealType: 'DINNER',
  });
  const onExtend = () =>
    runOnce(async () => {
      if (!end.date) return;
      const point = { date: end.date, mealType: end.mealType };
      const isConfirmed = await confirmAction({
        title: 'Extend this leave?',
        message: `The leave will end at ${describePoint(point)}.`,
        cancelLabel: 'Go Back',
        confirmLabel: 'Extend Leave',
      });
      if (!isConfirmed) return;
      onDone(
        await extend.mutateAsync({
          id: leave.id,
          body: { endDate: end.date, endMealType: end.mealType, version: leave.version },
        }),
      );
      setEnd({ date: null, mealType: 'DINNER' });
    });
  return (
    <View className="mb-6 rounded-lg border border-border bg-background p-4">
      <Text className="mb-2 text-base font-semibold text-foreground">Extend Leave</Text>
      <MealPointPicker
        dateLabel="New To Date"
        mealLabel="New To Meal"
        date={end.date}
        mealType={end.mealType}
        bounds={{
          firstDate: leave.endDate,
          lastDate: addBusinessDays(leave.endDate, LEAVE_MAX_DAYS),
          today: leave.endDate,
        }}
        onChange={(change) => setEnd((current) => ({ ...current, ...change }))}
      />
      {extend.error ? <MessageBanner message={extend.error.message} /> : null}
      <AppButton
        label="Extend Leave"
        variant="secondary"
        isLoading={extend.isPending}
        isDisabled={!end.date}
        onPress={onExtend}
      />
    </View>
  );
}

function EndSection({
  leave,
  earliest,
  onDone,
}: {
  leave: Leave;
  earliest: MealPoint;
  onDone: (result: LeaveResult) => void;
}) {
  const endLeave = useEndLeave();
  const runOnce = useSubmitLock();
  const start = { date: leave.startDate, mealType: leave.startMealType };
  const initial = comparePoints(earliest, start) > 0 ? earliest : start;
  const [resume, setResume] = useState<MealPoint>(initial);
  const cancelsAll = comparePoints(resume, start) <= 0;
  const onEnd = () =>
    runOnce(async () => {
      const isConfirmed = await confirmAction({
        title: cancelsAll ? 'Cancel this leave?' : 'End leave early?',
        message: cancelsAll
          ? 'The whole leave is cancelled and your meals are booked as usual.'
          : `Meals are booked again from ${describePoint(resume)}.`,
        cancelLabel: 'Keep Leave',
        confirmLabel: cancelsAll ? 'Cancel Leave' : 'Resume Meals',
        isDestructive: true,
      });
      if (!isConfirmed) return;
      onDone(
        await endLeave.mutateAsync({
          id: leave.id,
          body: {
            resumeDate: resume.date,
            resumeMealType: resume.mealType,
            version: leave.version,
          },
        }),
      );
    });
  return (
    <View className="mb-6 rounded-lg border border-border bg-background p-4">
      <Text className="mb-1 text-base font-semibold text-foreground">
        Cancel Leave / Resume Meals
      </Text>
      <Text className="mb-3 text-sm text-muted-foreground">
        Choose the first meal to book again. The earliest is {describePoint(earliest)}.
      </Text>
      <MealPointPicker
        dateLabel="Resume from"
        mealLabel="Resume at meal"
        date={resume.date}
        mealType={resume.mealType}
        bounds={{ firstDate: earliest.date, lastDate: leave.endDate, today: earliest.date }}
        onChange={(change) => setResume((current) => ({ ...current, ...change }))}
      />
      {endLeave.error ? <MessageBanner message={endLeave.error.message} /> : null}
      <AppButton
        label={cancelsAll ? 'Cancel Leave' : 'End Leave & Resume Meals'}
        variant="danger"
        isLoading={endLeave.isPending}
        onPress={onEnd}
      />
    </View>
  );
}
