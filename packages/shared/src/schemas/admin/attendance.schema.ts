import { z } from 'zod';
import { AttendanceSource } from '../../enums/attendance.js';
import { bookingStatusSchema } from '../bookings.schema.js';
import { businessDateSchema, overrideReasonSchema, uuidSchema } from '../common.schema.js';
import { dietTypeSchema, mealTypeSchema } from '../meal-config.schema.js';

/** Attendance imports are small (one meal window); kept well below the roster limit. */
export const ATTENDANCE_IMPORT_MAX_ROWS = 5000;
export const ATTENDANCE_IMPORT_COLUMN = 'reference_number';

export const attendanceWindowQuerySchema = z.object({
  date: businessDateSchema,
  mealType: mealTypeSchema,
});
export type AttendanceWindowQuery = z.infer<typeof attendanceWindowQuerySchema>;

export const outageWindowSchema = z.object({
  id: uuidSchema,
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  reason: z.string(),
  startedByName: z.string(),
});
export type OutageWindow = z.infer<typeof outageWindowSchema>;

/** `GET /admin/attendance/outage`: outage mode (Admin §I, BR-NS-7). */
export const outageStatusSchema = z.object({ active: outageWindowSchema.nullable() });
export type OutageStatus = z.infer<typeof outageStatusSchema>;
export const startOutageRequestSchema = z.object({ reason: overrideReasonSchema });
export const endOutageRequestSchema = z.object({ reason: overrideReasonSchema });

export const attendanceMarkSchema = z.object({
  studentName: z.string(),
  referenceNumber: z.string(),
  slotLabel: z.string().nullable(),
  source: z.enum(AttendanceSource),
  recordedAt: z.iso.datetime(),
  recordedByName: z.string().nullable(),
});
export type AttendanceMark = z.infer<typeof attendanceMarkSchema>;

/** `GET /admin/attendance/counter`: live attended vs booked for one meal window (Admin §I). */
export const attendanceCounterSchema = z.object({
  date: businessDateSchema,
  mealType: mealTypeSchema,
  mealName: z.string(),
  opensAt: z.iso.datetime(),
  closesAt: z.iso.datetime(),
  /** BEFORE (not yet open), OPEN (marking allowed) or CLOSED (window over). */
  phase: z.enum(['BEFORE', 'OPEN', 'CLOSED']),
  /** True once the closing job has turned Booked meals into Completed or No-show. */
  isFinalised: z.boolean(),
  outage: outageWindowSchema.nullable(),
  totals: z.object({
    booked: z.number().int(),
    attended: z.number().int(),
    noShow: z.number().int(),
  }),
  slots: z.array(
    z.object({
      slotId: uuidSchema,
      label: z.string(),
      booked: z.number().int(),
      attended: z.number().int(),
      noShow: z.number().int(),
      /** False until the slot's start time, so an empty slot reads "Not started", not behind. */
      hasStarted: z.boolean(),
    }),
  ),
  recent: z.array(attendanceMarkSchema),
});
export type AttendanceCounter = z.infer<typeof attendanceCounterSchema>;

export const attendanceLookupQuerySchema = attendanceWindowQuerySchema.extend({
  referenceNumber: z.string().trim().min(1, 'Enter a reference number').max(32),
});
export type AttendanceLookupQuery = z.infer<typeof attendanceLookupQuerySchema>;

/** Counter search result: just enough to confirm who is at the counter (no contact details). */
export const attendanceLookupSchema = z.object({
  student: z.object({
    id: uuidSchema,
    fullName: z.string(),
    referenceNumber: z.string(),
    blockName: z.string().nullable(),
  }),
  booking: z
    .object({
      id: uuidSchema,
      slotLabel: z.string(),
      dietType: dietTypeSchema,
      status: bookingStatusSchema,
    })
    .nullable(),
  attendance: z
    .object({
      source: z.enum(AttendanceSource),
      recordedAt: z.iso.datetime(),
      verifiedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  canMark: z.boolean(),
  /** Why marking is not possible, or that a reason is needed (no booking). */
  note: z.string().nullable(),
  needsReason: z.boolean(),
});
export type AttendanceLookup = z.infer<typeof attendanceLookupSchema>;

/** `POST /admin/attendance/marks`. A reason is required when the student has no booking (BR-ATT-2). */
export const markAttendanceRequestSchema = attendanceLookupQuerySchema.extend({
  reason: overrideReasonSchema.optional(),
});
export type MarkAttendanceRequest = z.input<typeof markAttendanceRequestSchema>;

export const ATTENDANCE_IMPORT_ROW_OUTCOMES = [
  'VALID',
  'INVALID',
  'DUPLICATE_IN_FILE',
  'EXISTING_UNCHANGED',
] as const;

export const attendanceImportRowSchema = z.object({
  rowNumber: z.number().int(),
  referenceNumber: z.string(),
  outcome: z.enum(ATTENDANCE_IMPORT_ROW_OUTCOMES),
  message: z.string().nullable(),
});
export type AttendanceImportRow = z.infer<typeof attendanceImportRowSchema>;

/** Validate-first attendance import for one window (Admin §I); confirm applies the VALID rows. */
export const attendanceImportSchema = z.object({
  id: uuidSchema,
  status: z.enum(['VALIDATED', 'COMPLETED', 'FAILED', 'CANCELLED']),
  fileName: z.string(),
  date: businessDateSchema,
  mealType: mealTypeSchema,
  totalRows: z.number().int(),
  validRows: z.number().int(),
  invalidRows: z.number().int(),
  /** Rows written on confirm. */
  appliedRows: z.number().int(),
  rows: z.array(attendanceImportRowSchema),
});
export type AttendanceImport = z.infer<typeof attendanceImportSchema>;
