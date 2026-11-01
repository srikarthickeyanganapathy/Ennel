import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { formatBusinessDate, todayBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { getLeaveCalendar } from '../api/leaves-api';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function shiftMonth(month: string, by: number): string {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

/** Darker cells for busier days, relative to the busiest day of the month. */
function intensity(count: number, max: number): string {
  if (count === 0) return 'text-muted-foreground';
  const share = count / max;
  if (share >= 0.75) return 'bg-primary text-primary-foreground';
  if (share >= 0.4) return 'bg-mint';
  return 'bg-neutral-surface';
}

/** Figma "Students away" calendar (Admin §K): approved leave per day, Monday first. */
export function LeaveCalendarCard() {
  const today = todayBusinessDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const calendar = useQuery({
    queryKey: ['admin-leaves', 'calendar', month],
    queryFn: () => getLeaveCalendar(month),
  });
  const days = calendar.data?.days ?? [];
  const max = Math.max(1, ...days.map((day) => day.count));
  // getUTCDay: 0 is Sunday; the grid starts on Monday.
  const offset = days[0] ? (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Students away · {formatBusinessDate(`${month}-01`, 'MMM yyyy')}
        </h2>
        <span className="flex">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </span>
      </div>
      <QueryBoundary
        isLoading={calendar.isLoading}
        error={calendar.error}
        onRetry={() => void calendar.refetch()}
      >
        <div role="grid" aria-label="Students away per day" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((weekday, index) => (
            <span
              key={`${weekday}-${index}`}
              aria-hidden
              className="text-center text-[11px] font-medium text-muted-foreground"
            >
              {weekday}
            </span>
          ))}
          {Array.from({ length: offset }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden />
          ))}
          {days.map((day) => (
            <div
              key={day.date}
              role="gridcell"
              aria-label={`${formatBusinessDate(day.date, 'EEE d MMM')}: ${day.count} ${day.count === 1 ? 'student' : 'students'} away`}
              className={cn(
                'flex flex-col items-center rounded-sm py-1.5 leading-tight',
                intensity(day.count, max),
                day.date === today && 'ring-2 ring-primary ring-offset-1',
              )}
            >
              <span className="text-xs font-semibold">{Number(day.date.slice(8))}</span>
              <span className="text-[10px]">{day.count}</span>
            </div>
          ))}
        </div>
      </QueryBoundary>
      <p className="text-xs text-muted-foreground">
        Number = students with approved leave that day. Their meals are paused, so the kitchen plans
        without them.
      </p>
    </Card>
  );
}
