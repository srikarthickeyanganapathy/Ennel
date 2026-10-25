import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { type Leave, type LeavesResponse } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { useLeaves } from '../hooks/use-leaves';
import { describeCount, describeRange, LEAVE_STATE_DISPLAY } from '../utils/leave-text';

const CURRENT_TEXT: Record<LeavesResponse['current']['status'], string> = {
  NOT_ON_LEAVE: 'Not on Leave',
  UPCOMING: 'Upcoming Leave',
  ON_LEAVE: 'On Leave',
  PENDING: 'Leave pending approval',
};

/** Spec §11: current leave status, history and Apply for Leave. */
export function LeaveScreen() {
  const leaves = useLeaves();
  return (
    <QueryState
      isLoading={leaves.isLoading}
      error={leaves.error}
      onRetry={() => void leaves.refetch()}
      loadingLabel="Loading your leave"
    >
      {leaves.data ? <LeaveContent data={leaves.data} /> : null}
    </QueryState>
  );
}

function LeaveContent({ data }: { data: LeavesResponse }) {
  const router = useRouter();
  const open = (leave: Leave) =>
    router.push({ pathname: '/(student)/leave/[id]', params: { id: leave.id } });
  const current = data.current.leave;
  return (
    <Screen
      footer={
        <AppButton label="Apply for Leave" onPress={() => router.push('/(student)/leave/apply')} />
      }
    >
      <Text className="mb-1 text-2xl font-bold text-foreground">Leave Management</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Meals during an approved leave are paused, so they are never booked or counted as No-shows.
        {data.requiresApproval ? ' New leave needs approval from the mess office.' : ''}
      </Text>
      <View className="mb-6 rounded-lg border border-border bg-mint p-4">
        <Text className="text-sm text-muted-foreground">Current status</Text>
        <Text className="text-lg font-semibold text-foreground" accessibilityRole="header">
          {CURRENT_TEXT[data.current.status]}
        </Text>
        {current ? (
          <Pressable accessibilityRole="button" onPress={() => open(current)} className="mt-1">
            <Text className="text-sm text-foreground">{describeRange(current)}</Text>
            <Text className="mt-1 text-sm font-semibold text-primary">View details ›</Text>
          </Pressable>
        ) : null}
      </View>
      <Text className="mb-2 text-sm font-semibold text-foreground" accessibilityRole="header">
        Leave history
      </Text>
      {data.items.length === 0 ? (
        <Text className="text-sm text-muted-foreground">You have not applied for leave yet.</Text>
      ) : null}
      {data.items.map((leave) => (
        <LeaveRow key={leave.id} leave={leave} onOpen={() => open(leave)} />
      ))}
    </Screen>
  );
}

function LeaveRow({ leave, onOpen }: { leave: Leave; onOpen: () => void }) {
  const display = LEAVE_STATE_DISPLAY[leave.state];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Leave ${describeRange(leave)}, ${display.text}. View details`}
      onPress={onOpen}
      className="mb-3 rounded-lg border border-border bg-background p-4"
    >
      <View className="flex-row items-start justify-between">
        <Text className="mr-2 flex-1 text-sm font-semibold text-foreground">
          {describeRange(leave)}
        </Text>
        <Text className={`rounded px-2 py-0.5 text-xs font-semibold ${display.badgeClassName}`}>
          {display.text}
        </Text>
      </View>
      <Text className="mt-1 text-xs text-muted-foreground">
        {describeCount(leave.days, leave.meals)}
      </Text>
    </Pressable>
  );
}
