import { type AttendanceCounter } from '@ennel/shared';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

type Slot = AttendanceCounter['slots'][number];

const HEAD = 'px-3 py-3 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground';
const CELL = 'px-3 py-3 text-[13px] whitespace-nowrap';

/** Figma "by slot" table (Admin §I). Attended counts every source, not only face verification. */
export function SlotCountsTable({ counter }: { counter: AttendanceCounter }) {
  if (counter.slots.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">No bookings for this meal.</p>
      </Card>
    );
  }
  return (
    <Card className="relative overflow-x-auto p-0">
      <table className="w-full min-w-[620px]">
        <caption className="sr-only">{counter.mealName} attendance by slot</caption>
        <thead className="bg-neutral-surface">
          <tr>
            <th scope="col" className={cn(HEAD, 'pl-5')}>
              Slot
            </th>
            <th scope="col" className={HEAD}>
              Booked
            </th>
            <th scope="col" className={HEAD}>
              Attended
            </th>
            <th scope="col" className={HEAD}>
              Pending
            </th>
            <th scope="col" className={HEAD}>
              No-show
            </th>
            <th scope="col" className={HEAD}>
              Progress
            </th>
          </tr>
        </thead>
        <tbody>
          {counter.slots.map((slot) => (
            <SlotRow key={slot.slotId} slot={slot} isFinalised={counter.isFinalised} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SlotRow({ slot, isFinalised }: { slot: Slot; isFinalised: boolean }) {
  const pending = Math.max(0, slot.booked - slot.attended - slot.noShow);
  // No-shows are only recorded when the window closes (BR-NS-1), so 0 before that means "not yet".
  const noShowText = slot.noShow > 0 || isFinalised ? slot.noShow : '—';
  return (
    <tr className="border-t border-border">
      <th scope="row" className={cn(CELL, 'pl-5 text-left font-semibold')}>
        {slot.label}
      </th>
      <td className={CELL}>{slot.booked}</td>
      <td
        className={cn(
          CELL,
          slot.attended > 0 ? 'font-semibold text-success' : 'text-muted-foreground',
        )}
      >
        {slot.attended}
      </td>
      <td
        className={cn(
          CELL,
          pending > 0 && slot.hasStarted ? 'font-semibold text-warning' : 'text-muted-foreground',
        )}
      >
        {pending}
      </td>
      <td
        className={cn(
          CELL,
          slot.noShow > 0 ? 'font-semibold text-danger' : 'text-muted-foreground',
        )}
      >
        {noShowText}
      </td>
      <td className={CELL}>
        <SlotProgress slot={slot} />
      </td>
    </tr>
  );
}

function SlotProgress({ slot }: { slot: Slot }) {
  if (!slot.hasStarted && slot.attended === 0) {
    return <StatusBadge label="Not started" tone="neutral" />;
  }
  const percent = Math.min(100, Math.round((slot.attended / slot.booked) * 100));
  return (
    <span className="flex w-[110px] flex-col gap-1">
      <span className="text-xs font-semibold">{percent}%</span>
      <span aria-hidden className="h-1.5 overflow-hidden rounded-[3px] bg-neutral-surface">
        <span className="block h-full rounded-[3px] bg-success" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}
