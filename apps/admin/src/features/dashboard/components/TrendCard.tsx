import { THEME_COLORS, type TrendDay } from '@ennel/shared';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/shared/components/ui/card';
import { formatBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

type View = 'served' | 'noShows';

/**
 * Figma "Served vs booked" line chart, with the Admin §C no-show rate one tap away so both
 * required 7-day charts stay on the dashboard.
 */
export function TrendCard({ trend }: { trend: TrendDay[] }) {
  const [view, setView] = useState<View>('served');
  const data = trend.map((day) => ({ ...day, label: formatBusinessDate(day.date, 'd MMM') }));
  const hasAttendance = trend.some((day) => day.noShowRatePct !== null);
  return (
    <Card className="flex flex-col gap-3 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">
            {view === 'served' ? 'Served vs booked · last 7 days' : 'No-show rate · last 7 days'}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {view === 'served'
              ? 'All meals · the gap is No-shows and cancellations after cooking'
              : hasAttendance
                ? 'No-shows ÷ (served + No-shows)'
                : 'Appears once attendance is recorded'}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Chart"
          className="flex rounded-md bg-neutral-surface p-1 text-xs"
        >
          {(['served', 'noShows'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={view === option}
              onClick={() => setView(option)}
              className={cn(
                'min-h-8 rounded-sm px-3',
                view === option
                  ? 'bg-background font-semibold text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-muted-foreground',
              )}
            >
              {option === 'served' ? 'Served vs booked' : 'No-show rate'}
            </button>
          ))}
        </div>
      </div>
      <div
        className="h-48"
        role="img"
        aria-label={
          view === 'served'
            ? `Booked and served per day: ${data.map((day) => `${day.label} ${day.booked} booked, ${day.completed} served`).join('; ')}`
            : `No-show rate per day: ${data.map((day) => `${day.label} ${day.noShowRatePct ?? 'no data'}`).join(', ')}`
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={THEME_COLORS.border} vertical={false} />
            <XAxis
              dataKey="label"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              stroke={THEME_COLORS.textMuted}
            />
            {view === 'served' ? (
              <YAxis
                allowDecimals={false}
                fontSize={11}
                width={36}
                tickLine={false}
                axisLine={false}
                stroke={THEME_COLORS.textMuted}
              />
            ) : (
              <YAxis
                unit="%"
                domain={[0, 100]}
                fontSize={11}
                width={40}
                tickLine={false}
                axisLine={false}
                stroke={THEME_COLORS.textMuted}
              />
            )}
            <Tooltip />
            {view === 'served' ? (
              <>
                <Line
                  type="monotone"
                  dataKey="booked"
                  name="Booked"
                  stroke={THEME_COLORS.textMuted}
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Served"
                  stroke={THEME_COLORS.primary}
                  strokeWidth={2}
                  dot={false}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="noShowRatePct"
                name="No-show %"
                stroke={THEME_COLORS.danger}
                strokeWidth={2}
                connectNulls
                dot
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
