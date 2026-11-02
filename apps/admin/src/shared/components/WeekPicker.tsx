import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, formatBusinessDate, startOfWeek } from '@/shared/lib/format';
import { DatePickerButton } from './DatePickerButton';
import { Button } from './ui/button';

function weekText(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const isSameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return `Week of ${formatBusinessDate(weekStart, isSameMonth ? 'd' : 'd MMM')} – ${formatBusinessDate(end, 'd MMM')}`;
}

/** The Figma "Week of 18 – 24 May" date button, with one-tap previous and next week. */
export function WeekPicker({
  weekStart,
  onChange,
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Previous week"
        onClick={() => onChange(addDays(weekStart, -7))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <DatePickerButton
        value={weekStart}
        text={weekText(weekStart)}
        label="Choose a week"
        onChange={(date) => date && onChange(startOfWeek(date))}
      />
      <Button
        size="icon"
        variant="ghost"
        aria-label="Next week"
        onClick={() => onChange(addDays(weekStart, 7))}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
