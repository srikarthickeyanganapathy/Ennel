import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { type StudentComplaint } from '@ennel/shared';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { QueryState } from '@/shared/components/QueryState';
import { Screen } from '@/shared/components/Screen';
import { formatBusinessDate, formatDateTime } from '@/shared/utils/format-date';
import { MEAL_LABELS } from '@/features/bookings/constants/booking-labels';
import { useMyReports } from '../hooks/use-complaints';
import { CATEGORY_LABELS, STATUS_TEXT, TYPE_LABELS } from '../utils/complaint-text';

/** One report: status, the mess office's reply and what was sent. Internal notes never appear. */
export function ComplaintDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const reports = useMyReports();
  const report = reports.data?.items.find((item) => item.id === id);
  return (
    <QueryState
      isLoading={reports.isLoading}
      error={reports.error}
      onRetry={() => void reports.refetch()}
      loadingLabel="Loading this report"
    >
      {report ? (
        <ReportDetail report={report} />
      ) : (
        <Screen>
          <MessageBanner message="This report was not found on this phone." />
        </Screen>
      )}
    </QueryState>
  );
}

function ReportDetail({ report }: { report: StudentComplaint }) {
  const status = STATUS_TEXT[report.status];
  const isClosed = report.status === 'RESOLVED' || report.status === 'REJECTED';
  return (
    <Screen>
      <Text accessibilityRole="header" className="mb-1 text-2xl font-bold text-foreground">
        {report.referenceCode}
      </Text>
      <Text className={`mb-4 text-base font-semibold ${status.className}`}>
        Status: {status.label}
      </Text>
      {report.response ? (
        <View className="mb-4 rounded-lg border border-primary bg-mint p-4">
          <Text className="mb-1 text-sm font-semibold text-primary">
            Reply from the mess office
          </Text>
          <Text className="text-base text-foreground">{report.response}</Text>
        </View>
      ) : (
        <Text className="mb-4 text-sm text-muted-foreground">
          {isClosed ? 'This report is closed.' : 'The mess office has not replied yet.'}
        </Text>
      )}
      <Detail label="Type" value={TYPE_LABELS[report.type]} />
      <Detail label="Category" value={CATEGORY_LABELS[report.category]} />
      {report.mealType && report.mealDate ? (
        <Detail
          label="Meal"
          value={`${MEAL_LABELS[report.mealType]}, ${formatBusinessDate(report.mealDate)}`}
        />
      ) : null}
      <Detail label="Sent" value={formatDateTime(report.createdAt)} />
      <Detail label="Photos" value={report.photoCount === 0 ? 'None' : String(report.photoCount)} />
      <Text className="mb-1 mt-2 text-sm font-medium text-muted-foreground">What you wrote</Text>
      <Text className="text-base text-foreground">{report.description}</Text>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row justify-between">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}
