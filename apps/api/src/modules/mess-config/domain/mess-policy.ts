import { type ComplaintPrivacyMode, type SlotFullFallback } from '@ennel/shared';

/** The `mess_policy` settings passed into domain functions (Rule 8, ADR-0005..0013). */
export interface MessPolicy {
  allowOverCapacityBooking: boolean;
  defaultSlotFullFallback: SlotFullFallback;
  leaveRequiresApproval: boolean;
  complaintPrivacyMode: ComplaintPrivacyMode;
  noShowWindowDays: number;
  noShowWarningThreshold: number;
  noShowDisableThreshold: number;
  cancellationCutoffMinutes: number;
  bookingHorizonDays: number;
  dietTypeChangeCutoffMinutes: number;
  fillingFastThresholdPct: number;
  recommendedMaxOccupancyPct: number;
  forecastLookbackDays: number;
  collegeControlledFields: string[];
  version: number;
}
