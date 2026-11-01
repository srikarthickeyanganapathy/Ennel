import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { type StudentComplaint } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { formatBusinessDate, formatDateTime } from '@/shared/utils/format-date';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import { useMyReports } from '../hooks/use-complaints';
import { CATEGORY_LABELS, privacyNote, STATUS_TEXT, TYPE_LABELS } from '../utils/complaint-text';

/** Spec §12 "My Reports / Status": the student's own reports only. */
export function ComplaintsScreen() {
  const router = useRouter();
  const reports = useMyReports();
  return (
    <Screen
      footer={
        <AppButton label="New Report" onPress={() => router.push('/(student)/complaints/new')} />
      }
    >
      <Text accessibilityRole="header" className="mb-1 text-2xl font-bold text-foreground">
        Complaints & Feedback
      </Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Report a problem with food, cleanliness or service, or share feedback.{' '}
        {reports.data ? privacyNote(reports.data.privacyMode) : ''}
      </Text>
      <QueryState
        isLoading={reports.isLoading}
        error={reports.error}
        onRetry={() => void reports.refetch()}
        loadingLabel="Loading your reports"
      >
        <Text className="mb-2 text-sm font-semibold text-foreground" accessibilityRole="header">
          My Reports
        </Text>
        {reports.data?.items.length === 0 ? (
          <Text className="text-sm text-muted-foreground">You have not sent any reports.</Text>
        ) : null}
        {reports.data?.items.map((item) => (
          <ReportRow key={item.id} report={item} />
        ))}
      </QueryState>
    </Screen>
  );
}

function ReportRow({ report }: { report: StudentComplaint }) {
  const router = useRouter();
  const status = STATUS_TEXT[report.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${report.referenceCode}, ${CATEGORY_LABELS[report.category]}, ${status.label}`}
      onPress={() =>
        router.push({ pathname: '/(student)/complaints/[id]', params: { id: report.id } })
      }
      className="mb-3 rounded-lg border border-border bg-background p-4"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">{report.referenceCode}</Text>
        <Text className={`text-sm font-semibold ${status.className}`}>{status.label}</Text>
      </View>
      <Text className="mt-1 text-base text-foreground">
        {TYPE_LABELS[report.type]} · {CATEGORY_LABELS[report.category]}
      </Text>
      <Text className="mt-1 text-xs text-muted-foreground">
        {report.mealType && report.mealDate
          ? `${MEAL_LABELS[report.mealType]}, ${formatBusinessDate(report.mealDate)} · `
          : ''}
        Sent {formatDateTime(report.createdAt)}
      </Text>
    </Pressable>
  );
}
