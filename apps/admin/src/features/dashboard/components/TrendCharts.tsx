import { THEME_COLORS, type TrendDay } from '@ennel/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader } from '@/shared/components/ui/card';
import { formatBusinessDate } from '@/shared/lib/format';

/** Admin §C: 7-day booking trend and no-show rate. */
export function TrendCharts({ trend }: { trend: TrendDay[] }) {
  const data = trend.map((day) => ({ ...day, label: formatBusinessDate(day.date, 'EEE d') }));
  const hasNoShowData = trend.some((day) => day.noShowRatePct !== null);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Bookings, last 7 days" />
        <div
          className="h-48"
          role="img"
          aria-label={`Bookings per day: ${data.map((day) => `${day.label} ${day.booked}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} width={32} />
              <Tooltip />
              <Bar
                dataKey="booked"
                name="Booked"
                fill={THEME_COLORS.primary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="No-show rate, last 7 days"
          description={hasNoShowData ? undefined : 'Appears once attendance is recorded.'}
        />
        <div
          className="h-48"
          role="img"
          aria-label={`No-show rate per day: ${data.map((day) => `${day.label} ${day.noShowRatePct ?? 'no data'}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis unit="%" domain={[0, 100]} fontSize={12} width={40} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="noShowRatePct"
                name="No-show %"
                stroke={THEME_COLORS.danger}
                connectNulls
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
