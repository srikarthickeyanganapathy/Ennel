import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  addBusinessDays,
  type BusinessDate,
  type DayResponse,
  toBusinessDate,
} from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { StepHeader } from '@/shared/components/StepHeader';
import { describeBusinessDate } from '@/shared/utils/format-date';
import { useMyProfile } from '@/features/onboarding/hooks/use-onboarding-queries';
import { useDay } from '@/features/bookings/hooks/use-bookings';
import { useLeaves } from '@/features/leave/hooks/use-leaves';
import { describeRange } from '@/features/leave/utils/leave-text';
import { NoShowWarnings } from '@/features/no-shows/components/NoShowWarnings';
import { DayMeals } from '../components/DayMeals';

/** Spec §4 Home: the student's meals for a date within the booking period. */
export function HomeScreen() {
  const [date, setDate] = useState<BusinessDate>(() => toBusinessDate(new Date()));
  const day = useDay(date);
  return (
    <QueryState
      isLoading={day.isLoading}
      error={day.error}
      onRetry={() => void day.refetch()}
      loadingLabel="Loading your meals"
    >
      {day.data ? <HomeContent day={day.data} onDateChange={setDate} /> : null}
    </QueryState>
  );
}

function HomeContent({
  day,
  onDateChange,
}: {
  day: DayResponse;
  onDateChange: (date: BusinessDate) => void;
}) {
  const router = useRouter();
  const me = useMyProfile();
  const tomorrow = addBusinessDays(day.today, 1);
  return (
    <Screen>
      <StepHeader
        title={`Welcome, ${me.data?.fullName ?? ''}`}
        subtitle={[me.data?.blockName, me.data?.roomNumber ? `Room ${me.data.roomNumber}` : null]
          .filter(Boolean)
          .join(' • ')}
      />
      <LeaveBanner />
      <NoShowWarnings />
      <DateSwitcher day={day} tomorrow={tomorrow} onDateChange={onDateChange} />
      <DayMeals key={day.date} day={day} />
      <View className="mb-6 gap-3">
        <AppButton
          label="Plan Ahead"
          variant="secondary"
          accessibilityHint="Change a future date or set weekday rules"
          onPress={() => router.push('/(student)/plan-ahead')}
        />
        <AppButton
          label="Leave Management"
          variant="secondary"
          accessibilityHint="Apply for, extend or end leave"
          onPress={() => router.push('/(student)/leave')}
        />
      </View>
    </Screen>
  );
}

/** Spec §11.2: "Booking Paused Due to Leave" while on leave, and a heads-up before one starts. */
function LeaveBanner() {
  const router = useRouter();
  const leaves = useLeaves();
  const current = leaves.data?.current;
  if (!current?.leave || (current.status !== 'ON_LEAVE' && current.status !== 'UPCOMING')) {
    return null;
  }
  const isOnLeave = current.status === 'ON_LEAVE';
  return (
    <View className="mb-4">
      <MessageBanner
        tone={isOnLeave ? 'warning' : 'info'}
        message={`${isOnLeave ? 'Booking Paused Due to Leave' : 'Upcoming leave'}: ${describeRange(current.leave)}`}
      />
      <AppButton
        label="Go to Leave Management"
        variant="secondary"
        onPress={() => router.push('/(student)/leave')}
      />
    </View>
  );
}

function DateSwitcher({
  day,
  tomorrow,
  onDateChange,
}: {
  day: DayResponse;
  tomorrow: BusinessDate;
  onDateChange: (date: BusinessDate) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-base font-semibold text-foreground" accessibilityRole="header">
        {describeBusinessDate(day.date, day.today, tomorrow)}
      </Text>
      {day.date !== day.today ? (
        <Text className="text-sm text-info">You are viewing a future date.</Text>
      ) : null}
      <View className="mt-2 flex-row gap-3">
        <View className="flex-1">
          <AppButton
            label="Previous Day"
            variant="secondary"
            onPress={() => onDateChange(addBusinessDays(day.date, -1))}
            isDisabled={day.date <= day.today}
          />
        </View>
        <View className="flex-1">
          <AppButton
            label="Next Day"
            variant="secondary"
            onPress={() => onDateChange(addBusinessDays(day.date, 1))}
            isDisabled={day.date >= day.lastBookableDate}
          />
        </View>
      </View>
    </View>
  );
}
