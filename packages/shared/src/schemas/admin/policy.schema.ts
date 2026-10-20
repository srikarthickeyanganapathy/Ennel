import { z } from 'zod';
import { ComplaintPrivacyMode, SlotFullFallback } from '../../enums/policy.js';
import { overrideReasonSchema } from '../common.schema.js';
import { STUDENT_PROFILE_FIELDS } from '../profile.schema.js';

/** Fields of `mess_policy` (Rule 8). Thresholds are edited on the mess configuration page (ADR-0013). */
export const messPolicySchema = z.object({
  allowOverCapacityBooking: z.boolean(),
  defaultSlotFullFallback: z.enum([
    SlotFullFallback.AUTO_NEXT_AVAILABLE,
    SlotFullFallback.ASK_STUDENT,
  ]),
  leaveRequiresApproval: z.boolean(),
  complaintPrivacyMode: z.enum([
    ComplaintPrivacyMode.ANONYMOUS,
    ComplaintPrivacyMode.PRIVATE_IDENTIFIED,
  ]),
  noShowWindowDays: z.number().int(),
  noShowWarningThreshold: z.number().int(),
  noShowDisableThreshold: z.number().int(),
  cancellationCutoffMinutes: z.number().int(),
  bookingHorizonDays: z.number().int(),
  dietTypeChangeCutoffMinutes: z.number().int(),
  fillingFastThresholdPct: z.number().int(),
  recommendedMaxOccupancyPct: z.number().int(),
  forecastLookbackDays: z.number().int(),
  collegeControlledFields: z.array(z.enum(STUDENT_PROFILE_FIELDS)),
  version: z.number().int(),
  updatedAt: z.iso.datetime(),
  updatedByName: z.string().nullable(),
});
export type MessPolicyView = z.infer<typeof messPolicySchema>;

export const POLICY_FIELDS = [
  'allowOverCapacityBooking',
  'defaultSlotFullFallback',
  'leaveRequiresApproval',
  'complaintPrivacyMode',
  'noShowWindowDays',
  'noShowWarningThreshold',
  'noShowDisableThreshold',
  'cancellationCutoffMinutes',
  'bookingHorizonDays',
  'dietTypeChangeCutoffMinutes',
  'forecastLookbackDays',
  'collegeControlledFields',
] as const;
export type PolicyField = (typeof POLICY_FIELDS)[number];

/** Ranges from ADR-0009..0012; cross-field rules are checked by the API. */
export const updatePolicyRequestSchema = z
  .object({
    allowOverCapacityBooking: z.boolean(),
    defaultSlotFullFallback: messPolicySchema.shape.defaultSlotFullFallback,
    leaveRequiresApproval: z.boolean(),
    complaintPrivacyMode: messPolicySchema.shape.complaintPrivacyMode,
    noShowWindowDays: z.number().int().min(7).max(90),
    noShowWarningThreshold: z.number().int().min(1).max(20),
    noShowDisableThreshold: z.number().int().min(2).max(30),
    cancellationCutoffMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60),
    bookingHorizonDays: z.number().int().min(1).max(60),
    dietTypeChangeCutoffMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60),
    forecastLookbackDays: z.number().int().min(7).max(60),
    collegeControlledFields: z.array(z.enum(STUDENT_PROFILE_FIELDS)),
  })
  .partial()
  .extend({ version: z.number().int().min(1), reason: overrideReasonSchema });
export type UpdatePolicyRequest = z.input<typeof updatePolicyRequestSchema>;

export const policyHistoryItemSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  before: z.record(z.string(), z.unknown()),
  after: z.record(z.string(), z.unknown()),
  reason: z.string(),
  changedByName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type PolicyHistoryItem = z.infer<typeof policyHistoryItemSchema>;

/** Plain-language explanations shown next to each setting (Admin §D). */
export const POLICY_DESCRIPTIONS: Readonly<
  Record<PolicyField | 'fillingFastThresholdPct' | 'recommendedMaxOccupancyPct', string>
> = {
  allowOverCapacityBooking:
    'Allow bookings after a slot reaches its official capacity. Extra bookings are shown separately. Needs institutional approval (ADR-0005).',
  defaultSlotFullFallback:
    "When a student's default slot is full: ask the student to choose, or book the next available slot and tell them (ADR-0006).",
  leaveRequiresApproval:
    'Leave stays pending, and meals keep their bookings, until staff approve it (ADR-0007).',
  complaintPrivacyMode:
    'Anonymous: student identity is never stored with a complaint. Private: staff can see who submitted it (ADR-0008).',
  noShowWindowDays: 'Number of days counted for No-shows, per meal (ADR-0009).',
  noShowWarningThreshold: 'No-shows in the window before the student sees a warning.',
  noShowDisableThreshold: 'No-shows in the window that switch off Default Booking for that meal.',
  cancellationCutoffMinutes: 'Minutes before slot start when cancellation closes (ADR-0010).',
  bookingHorizonDays: 'How many days ahead students can view and book meals (ADR-0011).',
  dietTypeChangeCutoffMinutes:
    'Minutes before slot start when Veg/Non-Veg can no longer be changed (ADR-0012).',
  forecastLookbackDays: 'Days of attendance history used for kitchen forecasts.',
  collegeControlledFields: 'Profile fields students cannot edit themselves (ADR-0018).',
  fillingFastThresholdPct: 'Occupancy at which a slot is labelled "Filling Fast" (ADR-0013).',
  recommendedMaxOccupancyPct:
    'Highest occupancy at which the least-busy slot is still "Recommended".',
};
