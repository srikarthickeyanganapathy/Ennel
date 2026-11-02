import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { listPolicyHistory } from '@/features/mess-config/api/mess-config-api';
import { QueryBoundary } from '@/shared/components/QueryStates';
import { Card } from '@/shared/components/ui/card';
import { formatDateTime } from '@/shared/lib/format';

const FIELD_NAMES: Record<string, string> = {
  allowOverCapacityBooking: 'Bookings above capacity',
  defaultSlotFullFallback: 'When a default slot is full',
  leaveRequiresApproval: 'Leave approval',
  complaintPrivacyMode: 'Complaint privacy',
  noShowWindowDays: 'No-show window',
  noShowWarningThreshold: 'No-show warning',
  noShowDisableThreshold: 'Default Booking off at',
  cancellationCutoffMinutes: 'Cancel deadline (minutes)',
  bookingHorizonDays: 'Booking horizon (days)',
  dietTypeChangeCutoffMinutes: 'Veg/Non-Veg deadline (minutes)',
  fillingFastThresholdPct: 'Filling Fast at (%)',
  recommendedMaxOccupancyPct: 'Recommended up to (%)',
  forecastLookbackDays: 'Forecast history (days)',
  collegeControlledFields: 'College-controlled fields',
};

const show = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value));

/** Figma "Change log": who changed which rule, when and why (Admin §D). */
export function PolicyChangeLog() {
  const history = useQuery({ queryKey: ['policy-history'], queryFn: () => listPolicyHistory(1) });
  return (
    <Card id="change-log" className="scroll-mt-20 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <History aria-hidden className="size-[18px] text-muted-foreground" />
        Change log
      </h2>
      <QueryBoundary isLoading={history.isLoading} error={history.error}>
        <ul className="mt-3 flex flex-col gap-3 text-[13px]">
          {(history.data?.items ?? []).map((item) => (
            <li key={item.id}>
              <p className="flex flex-wrap gap-x-3">
                <span className="text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                <span className="font-semibold">{item.changedByName ?? 'System'}</span>
                <span>{item.reason}</span>
              </p>
              <ul className="mt-0.5 text-xs text-muted-foreground">
                {Object.keys(item.after).map((key) => (
                  <li key={key}>
                    {FIELD_NAMES[key] ?? key}: {show(item.before[key])} → {show(item.after[key])}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {history.data?.items.length === 0 ? (
            <li className="text-muted-foreground">No changes yet.</li>
          ) : null}
        </ul>
      </QueryBoundary>
    </Card>
  );
}
