import {
  type AdminReport,
  type CancellationBucket,
  type ComplaintCategory,
  type MealType,
} from '@ennel/shared';
import { BarList } from '@/shared/components/BarList';
import { BookedServedChart } from '@/shared/components/BookedServedChart';
import { TABLE_CELL, TABLE_HEAD } from '@/shared/components/table-styles';
import { Card } from '@/shared/components/ui/card';
import { formatBusinessDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

const CATEGORY_NAMES: Record<ComplaintCategory, string> = {
  FOOD_QUALITY: 'Food quality',
  FOREIGN_OBJECT: 'Foreign object',
  CLEANLINESS: 'Cleanliness',
  SERVICE: 'Service',
  MENU: 'Menu',
  OTHER: 'Other',
};
const BUCKET_NAMES: Record<CancellationBucket, string> = {
  UNDER_1_HOUR: 'Under 1 hour',
  HOURS_1_TO_6: '1 to 6 hours',
  HOURS_6_TO_24: '6 to 24 hours',
  OVER_24_HOURS: 'Over 24 hours',
};
const LEAVE_NAMES: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};
const count = (value: number) => value.toLocaleString('en-IN');
const percent = (value: number | null) => (value === null ? '—' : `${value}%`);

export function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}

function SectionCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </Card>
  );
}

/** Figma "Attendance categories". Early and late arrival are left out: see ADR-0029. */
export function MealTable({ report }: { report: AdminReport }) {
  const { kpis } = report;
  const rows = [
    ...report.byMeal.map((meal) => ({ key: meal.mealType, name: meal.mealName, ...meal })),
    { key: 'all', name: 'Overall', ...kpis },
  ];
  return (
    <Card className="p-0">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold">Attendance categories</h2>
        <p className="text-xs text-muted-foreground">
          {formatBusinessDate(report.from, 'd MMM')} – {formatBusinessDate(report.to, 'd MMM')}.
          Closed meals and meals paused for leave are not counted.
        </p>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <caption className="sr-only">Attendance by meal</caption>
          <thead className="bg-neutral-surface">
            <tr>
              {['Meal', 'Served', 'Cancelled', 'No-show', 'Not finished', 'Total booked'].map(
                (heading) => (
                  <th key={heading} scope="col" className={TABLE_HEAD}>
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOverall = row.key === 'all';
              return (
                <tr
                  key={row.key}
                  className={cn('border-t border-border', isOverall && 'bg-surface font-semibold')}
                >
                  <th scope="row" className={`${TABLE_CELL} text-left font-semibold`}>
                    {row.name}
                  </th>
                  <td className={TABLE_CELL}>{count(row.served)}</td>
                  <td className={TABLE_CELL}>{count(row.cancelled)}</td>
                  <td className={cn(TABLE_CELL, !isOverall && row.noShows > 0 && 'text-danger')}>
                    {count(row.noShows)}
                  </td>
                  <td className={TABLE_CELL}>{count(row.pending)}</td>
                  <td className={TABLE_CELL}>{count(row.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function TrendSection({ report }: { report: AdminReport }) {
  return (
    <SectionCard title="Bookings vs attendance" note={`Per ${report.groupBy}, all selected meals`}>
      {report.series.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings in this range.</p>
      ) : (
        <BookedServedChart
          data={report.series.map((row) => ({
            label: formatBusinessDate(
              row.period,
              report.groupBy === 'month' ? 'MMM yyyy' : 'd MMM',
            ),
            booked: row.booked,
            served: row.served,
          }))}
        />
      )}
    </SectionCard>
  );
}

/** Figma "Crowding by time": one meal's slots; Overall shows Lunch, as the design does. */
export function CrowdingSection({
  report,
  mealType,
}: {
  report: AdminReport;
  mealType: MealType | null;
}) {
  const meal = mealType ?? 'LUNCH';
  const slots = report.slots
    .filter((slot) => slot.mealType === meal)
    .sort((a, b) => a.startMinute - b.startMinute);
  const max = Math.max(1, ...slots.map((slot) => slot.averageServedPerDay));
  return (
    <SectionCard
      title={`Crowding by time · ${MEAL_NAMES[meal].toLowerCase()}`}
      note="Average students served per day in each slot"
    >
      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No slots for this meal.</p>
      ) : (
        <ul className="flex h-44 items-end gap-3 overflow-x-auto">
          {slots.map((slot) => (
            <li
              key={slot.slotId}
              className="flex h-full min-w-14 flex-1 flex-col justify-end gap-1"
            >
              <span className="text-center text-xs font-semibold">
                {count(slot.averageServedPerDay)}
              </span>
              <span
                aria-hidden
                className="mx-auto w-9 rounded-t-sm bg-primary"
                style={{ height: `${Math.max(2, (slot.averageServedPerDay / max) * 100)}%` }}
              />
              <span className="truncate text-center text-[11px] text-muted-foreground">
                {slot.label.split(' - ')[0]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function ComplaintsSection({ report }: { report: AdminReport }) {
  const { complaints } = report;
  return (
    <SectionCard
      title="Complaints by category"
      note={
        complaints.averageResolutionHours === null
          ? `${complaints.total} total`
          : `${complaints.total} total · resolved in ${complaints.averageResolutionHours} hours on average`
      }
    >
      {complaints.total === 0 ? (
        <p className="text-sm text-muted-foreground">No complaints in this range.</p>
      ) : (
        <BarList
          rows={complaints.byCategory.map((row) => ({
            key: row.category,
            label: CATEGORY_NAMES[row.category],
            value: row.count,
          }))}
        />
      )}
    </SectionCard>
  );
}

export function CancellationsSection({ report }: { report: AdminReport }) {
  const { cancellations } = report;
  return (
    <SectionCard
      title="Cancellation lead time"
      note={
        cancellations.averageLeadMinutes === null
          ? 'How long before the slot students cancel'
          : `${cancellations.total} cancelled, ${Math.round(cancellations.averageLeadMinutes / 60)} hours before the slot on average`
      }
    >
      <BarList
        rows={cancellations.buckets.map((row) => ({
          key: row.bucket,
          label: BUCKET_NAMES[row.bucket],
          value: row.count,
        }))}
      />
    </SectionCard>
  );
}

export function LeavesSection({ report }: { report: AdminReport }) {
  return (
    <SectionCard title="Leave volume" note="Requests starting in this range, for all meals">
      {report.leaves.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leave in this range.</p>
      ) : (
        <BarList
          rows={report.leaves.map((row) => ({
            key: row.status,
            label: LEAVE_NAMES[row.status] ?? row.status,
            value: row.count,
          }))}
        />
      )}
    </SectionCard>
  );
}

function SmallTable({
  caption,
  headings,
  rows,
}: {
  caption: string;
  headings: string[];
  rows: { key: string; cells: string[] }[];
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[420px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-neutral-surface">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className={TABLE_HEAD}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              {row.cells.map((cell, index) => (
                <td key={index} className={cn(TABLE_CELL, index === 0 && 'font-semibold')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HostelsSection({ report }: { report: AdminReport }) {
  return (
    <Card className="p-0">
      <h2 className="px-5 pt-5 pb-3 text-base font-semibold">No-show rate by hostel</h2>
      {report.byHostel.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No finished meals in this range.</p>
      ) : (
        <SmallTable
          caption="No-show rate by hostel"
          headings={['Hostel', 'Served', 'No-shows', 'Rate']}
          rows={report.byHostel.map((row) => ({
            key: row.hostelId ?? 'none',
            cells: [
              row.hostelName,
              count(row.served),
              count(row.noShows),
              percent(row.noShowRatePct),
            ],
          }))}
        />
      )}
    </Card>
  );
}

export function SlotsSection({ report }: { report: AdminReport }) {
  return (
    <Card className="p-0">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold">Slot utilization</h2>
        <p className="text-xs text-muted-foreground">
          Seats taken against capacity on open days. Not shown for a single hostel.
        </p>
      </div>
      <SmallTable
        caption="Slot utilization"
        headings={['Meal', 'Slot', 'Used', 'Days over capacity']}
        rows={report.slots.map((slot) => ({
          key: slot.slotId,
          cells: [
            MEAL_NAMES[slot.mealType],
            slot.label,
            percent(slot.utilizationPct),
            count(slot.overCapacityDays),
          ],
        }))}
      />
    </Card>
  );
}
