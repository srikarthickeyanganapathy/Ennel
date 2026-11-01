import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { type BookingRecord, formatMinuteOfDay } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { formatBusinessDate, formatClockTime, formatDateTime } from '@/shared/utils/format-date';
import { DIET_LABELS } from '@/features/bookings/constants/booking-labels';
import { useNoShowSummary } from '@/features/no-shows/hooks/use-no-shows';
import { eventStatusText } from '@/features/no-shows/utils/no-show-text';
import { HISTORY_STATUS_DISPLAY, SOURCE_TEXT } from '../constants/history-display';
import { useBookingRecord } from '../hooks/use-booking-history';

/** Spec §7 "View Details": the full record with its timestamps. */
export function BookingRecordScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  return <RecordView id={id} />;
}

function RecordView({ id }: { id: string }) {
  const record = useBookingRecord(id);
  return (
    <QueryState
      isLoading={record.isLoading}
      error={record.error}
      onRetry={() => void record.refetch()}
      loadingLabel="Loading this meal"
    >
      {record.data ? <RecordDetails record={record.data} /> : null}
    </QueryState>
  );
}

function RecordDetails({ record }: { record: BookingRecord }) {
  const display = HISTORY_STATUS_DISPLAY[record.status];
  const slot = `${formatMinuteOfDay(record.slotStartMinute)} – ${formatMinuteOfDay(record.slotEndMinute)}`;
  return (
    <Screen>
      <Text className="text-sm font-medium text-muted-foreground">My Bookings</Text>
      <Text className="mb-2 text-2xl font-bold text-foreground" accessibilityRole="header">
        {record.mealName}, {formatBusinessDate(record.date)}
      </Text>
      <Text
        className={`mb-4 self-start rounded px-2 py-1 text-sm font-semibold ${display.badgeClassName}`}
      >
        {display.text}
      </Text>
      {record.isUpdatedByStaff ? (
        <MessageBanner tone="info" message="Updated by mess staff." />
      ) : null}
      <View className="mb-4 rounded-lg border border-border bg-background p-4">
        <Row label="Slot" value={slot} />
        <Row label="Meal type" value={DIET_LABELS[record.dietType]} />
        <Row label="Booked through" value={SOURCE_TEXT[record.source]} />
        <Row label="Booked at" value={formatDateTime(record.bookedAt)} />
        {record.cancelledAt && record.status === 'CANCELLED' ? (
          <Row label="Cancelled at" value={formatDateTime(record.cancelledAt)} />
        ) : null}
        <AttendanceRows record={record} />
      </View>
      <OutcomeNote record={record} />
    </Screen>
  );
}

/** BR-ATT-1: a verification time appears only when the face-verification system provided one. */
function AttendanceRows({ record }: { record: BookingRecord }) {
  const attendance = record.attendance;
  if (!attendance) return null;
  if (attendance.source === 'FACE_VERIFICATION' && attendance.verifiedAt) {
    return <Row label="Face Verified" value={`at ${formatClockTime(attendance.verifiedAt)}`} />;
  }
  if (attendance.source === 'MANUAL_FALLBACK') {
    return (
      <Row
        label="Attendance"
        value={`Marked at the counter by mess staff, ${formatClockTime(attendance.recordedAt)}`}
      />
    );
  }
  return <Row label="Attendance" value="Recorded from the attendance file" />;
}

function OutcomeNote({ record }: { record: BookingRecord }) {
  if (record.status === 'CANCELLED_BY_CLOSURE') {
    return (
      <MessageBanner
        tone="warning"
        message={`The mess was closed${record.closureTitle ? ` (${record.closureTitle})` : ''}. No No-show was recorded.`}
      />
    );
  }
  if (record.status !== 'NO_SHOW') return null;
  if (record.noShow?.status === 'HELD_FOR_REVIEW') {
    return (
      <MessageBanner
        tone="info"
        message="The meal window ended without recorded attendance while the attendance system was down. Mess staff will review it; it does not count until then."
      />
    );
  }
  return (
    <View>
      <MessageBanner tone="error" message="The meal window ended without recorded attendance." />
      <ReportLink bookingId={record.id} />
    </View>
  );
}

/** Spec §7 "a way to report a possible attendance-system error". */
function ReportLink({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const summary = useNoShowSummary();
  const event = summary.data?.events.find((item) => item.bookingId === bookingId);
  if (!event) return null;
  return (
    <View>
      <Text className="mb-3 text-sm text-muted-foreground">{eventStatusText(event)}</Text>
      {event.canAppeal ? (
        <AppButton
          label="Report incorrect record"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/(student)/no-shows/report/[id]', params: { id: event.id } })
          }
        />
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="mr-3 text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}
