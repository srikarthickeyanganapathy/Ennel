import { type Forecast } from '@ennel/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api-client/api-error';
import { BarList } from '@/shared/components/BarList';
import { BookedServedChart } from '@/shared/components/BookedServedChart';
import { PermissionGate } from '@/shared/components/PermissionGate';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { WeekPicker } from '@/shared/components/WeekPicker';
import { PageHeader } from '@/shared/layout/PageHeader';
import { addDays, formatBusinessDate, startOfWeek, todayBusinessDate } from '@/shared/lib/format';
import { exportKitchenSheet, getForecast } from '../api/forecast-api';
import { ForecastGrid } from '../components/ForecastGrid';
import { SlotBreakdownCard } from '../components/SlotBreakdownCard';

const WEEK_DAYS = 7;

/** Figma "Admin — Meal forecast" (Admin §N, BR-FC-1). Waste is in plates: see ADR-0029. */
export function ForecastPage() {
  const today = todayBusinessDate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const forecast = useQuery({
    queryKey: ['forecast', weekStart],
    queryFn: () => getForecast(weekStart, WEEK_DAYS),
  });
  const download = useMutation({
    mutationFn: (format: 'pdf' | 'xlsx') => exportKitchenSheet(weekStart, WEEK_DAYS, format),
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div>
      <PageHeader
        title="Meal forecast"
        breadcrumbs={[{ label: 'Meal forecast' }]}
        description="Booked now and expected after typical No-shows"
        actions={<WeekPicker weekStart={weekStart} onChange={setWeekStart} />}
      />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Legend className="bg-neutral-surface" text="Locked: cancel deadline passed" />
        <Legend className="bg-info-surface" text="Open: can still change" />
        <PermissionGate permissions={['forecasting:export']}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="ml-auto h-12 font-semibold text-primary"
                disabled={download.isPending}
              >
                {download.isPending ? 'Exporting…' : 'Export week'}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => download.mutate('pdf')}>
                Kitchen sheet (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download.mutate('xlsx')}>
                Kitchen sheet (Excel)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PermissionGate>
      </div>
      <QueryBoundary
        isLoading={forecast.isLoading}
        error={forecast.error}
        onRetry={() => void forecast.refetch()}
      >
        {forecast.data ? <ForecastBody data={forecast.data} weekStart={weekStart} /> : null}
      </QueryBoundary>
    </div>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className={`size-3.5 rounded-sm border border-border ${className}`} />
      {text}
    </span>
  );
}

function ForecastBody({ data, weekStart }: { data: Forecast; weekStart: string }) {
  const dates = Array.from({ length: WEEK_DAYS }, (_, offset) => addDays(weekStart, offset));
  const lowConfidence = [
    ...new Set(
      data.meals
        .filter((meal) => meal.isLowConfidence && !meal.closureTitle)
        .map((meal) => meal.mealName),
    ),
  ];
  return (
    <div className="flex flex-col gap-6">
      {lowConfidence.length > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-md bg-info-surface p-3 text-[13px]"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
          Low confidence for {lowConfidence.join(', ')}: under 7 days of attendance history, so
          expected plates may be off. With no history at all, expected equals booked.
        </p>
      ) : null}
      <ForecastGrid dates={dates} today={data.today} meals={data.meals} />
      <SlotBreakdownCard
        key={weekStart}
        dates={dates}
        initialDate={dates.includes(data.today) ? data.today : (dates[0] ?? weekStart)}
        meals={data.meals}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold">Booked vs served · last 30 days</h2>
            <p className="text-xs text-muted-foreground">All meals per day</p>
          </div>
          {data.trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">Appears once meals have finished.</p>
          ) : (
            <BookedServedChart
              data={data.trend.map((day) => ({
                label: formatBusinessDate(day.date, 'd MMM'),
                booked: day.booked,
                served: day.served,
              }))}
            />
          )}
        </Card>
        <WasteCard weeks={data.wasteWeeks} />
      </div>
    </div>
  );
}

/** ADR-0029: plates booked and not attended. Kilograms need a plate weight nobody records yet. */
function WasteCard({ weeks }: { weeks: Forecast['wasteWeeks'] }) {
  const first = weeks[0]?.plates ?? 0;
  const last = weeks[weeks.length - 1]?.plates ?? 0;
  const changePct = first > 0 ? Math.round(((first - last) / first) * 100) : null;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Food waste estimate</h2>
        <p className="text-xs text-muted-foreground">Plates booked but not eaten, per week</p>
      </div>
      <BarList
        labelWidth="w-14"
        rows={weeks.map((week) => ({
          key: week.weekStart,
          label: formatBusinessDate(week.weekStart, 'd MMM'),
          value: week.plates,
        }))}
      />
      {changePct !== null && changePct > 0 ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <Check aria-hidden className="size-3.5" />
          {changePct}% less than 3 weeks earlier
        </p>
      ) : null}
    </Card>
  );
}
