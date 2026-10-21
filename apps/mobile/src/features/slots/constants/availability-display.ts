import { type SlotStatusLabel, type SlotUnavailableReason } from '@ennel/shared';

interface StatusDisplay {
  label: string;
  /** Badge classes: always text plus colour (Spec §14). */
  badgeClassName: string;
}

export const STATUS_DISPLAY: Record<SlotStatusLabel, StatusDisplay> = {
  AVAILABLE: { label: 'Available', badgeClassName: 'bg-success-surface text-success' },
  FILLING_FAST: { label: 'Filling Fast', badgeClassName: 'bg-warning-surface text-warning' },
  FULL: { label: 'Full', badgeClassName: 'bg-danger-surface text-danger' },
  OVER_CAPACITY: { label: 'Over Capacity', badgeClassName: 'bg-danger-surface text-danger' },
};

export const RECOMMENDED_DISPLAY: StatusDisplay = {
  label: 'Recommended',
  badgeClassName: 'bg-info-surface text-info',
};

/** A slot that cannot be chosen for a reason other than capacity shows that reason instead. */
export const CLOSED_STATUS_DISPLAY: Record<'STARTED' | 'CLOSED', StatusDisplay> = {
  STARTED: { label: 'Started', badgeClassName: 'bg-surface text-muted-foreground' },
  CLOSED: { label: 'Closed', badgeClassName: 'bg-surface text-muted-foreground' },
};

export const UNAVAILABLE_REASON_TEXT: Record<SlotUnavailableReason, string> = {
  CLOSED: 'The mess is closed for this meal.',
  STARTED: 'This slot has already started.',
  FULL: 'This slot is full.',
};

/** Spec §5.2 wording for a slot past official capacity when the policy accepts more. */
export const OVER_CAPACITY_NOTICE =
  'Official capacity reached — additional bookings are being accepted under the mess policy.';
