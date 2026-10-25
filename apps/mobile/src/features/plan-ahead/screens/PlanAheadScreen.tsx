import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { Screen } from '@/shared/components/Screen';
import { useWeekdayRules } from '../hooks/use-weekday-rules';
import { describeRule, PAUSED_TEXT } from '../utils/weekdays';

/** Spec §6: change one date (6.1) or set a repeating weekday rule (6.2). */
export function PlanAheadScreen() {
  const router = useRouter();
  const rules = useWeekdayRules();
  const today = toBusinessDate(new Date());
  const openDay = (date: string) =>
    router.push({ pathname: '/(student)/plan-ahead/day', params: { date } });

  return (
    <Screen>
      <Text className="mb-1 text-2xl font-bold text-foreground">Plan Ahead</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Change meals for one date, or repeat a different slot on chosen weekdays. Your Default
        Booking stays the same.
      </Text>

      <Text className="mb-2 text-sm font-semibold text-foreground" accessibilityRole="header">
        One date
      </Text>
      <View className="mb-2 flex-row gap-3">
        <View className="flex-1">
          <AppButton label="Today" variant="secondary" onPress={() => openDay(today)} />
        </View>
        <View className="flex-1">
          <AppButton
            label="Tomorrow"
            variant="secondary"
            onPress={() => openDay(addBusinessDays(today, 1))}
          />
        </View>
      </View>
      <View className="mb-6">
        <AppButton
          label="Choose a Date"
          variant="secondary"
          onPress={() => router.push('/(student)/plan-ahead/calendar')}
        />
      </View>

      <Text className="mb-1 text-sm font-semibold text-foreground" accessibilityRole="header">
        Weekday rules
      </Text>
      <Text className="mb-3 text-sm text-muted-foreground">
        A one-date change always wins over a weekday rule for that date.
      </Text>
      {rules.error ? <MessageBanner message={rules.error.message} /> : null}
      {rules.isLoading ? (
        <Text className="mb-3 text-sm text-muted-foreground">Loading your rules…</Text>
      ) : null}
      {rules.data?.length === 0 ? (
        <Text className="mb-3 text-sm text-muted-foreground">No weekday rules yet.</Text>
      ) : null}
      {rules.data?.map((rule) => (
        <Pressable
          key={rule.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit rule: ${describeRule(rule)}`}
          onPress={() =>
            router.push({ pathname: '/(student)/plan-ahead/rule', params: { id: rule.id } })
          }
          className="mb-3 flex-row items-center justify-between rounded-lg border border-border bg-background p-4"
        >
          <View className="mr-3 flex-1">
            <Text className="text-base text-foreground">{describeRule(rule)}</Text>
            {rule.pausedReason ? (
              <Text className="mt-1 text-xs text-warning">{PAUSED_TEXT[rule.pausedReason]}</Text>
            ) : null}
          </View>
          <Text className="text-base font-semibold text-primary">Edit ›</Text>
        </Pressable>
      ))}
      <AppButton label="Choose a Day" onPress={() => router.push('/(student)/plan-ahead/rule')} />
    </Screen>
  );
}
