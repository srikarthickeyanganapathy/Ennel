/** Admin §I. */
export const AttendanceSource = {
  FACE_VERIFICATION: 'FACE_VERIFICATION',
  MANUAL_FALLBACK: 'MANUAL_FALLBACK',
  IMPORT: 'IMPORT',
} as const;
export type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];

/** BR-NS-3, BR-NS-7, BR-NS-8. */
export const NoShowStatus = {
  COUNTED: 'COUNTED',
  HELD_FOR_REVIEW: 'HELD_FOR_REVIEW',
  EXCLUDED: 'EXCLUDED',
} as const;
export type NoShowStatus = (typeof NoShowStatus)[keyof typeof NoShowStatus];

export const AppealStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type AppealStatus = (typeof AppealStatus)[keyof typeof AppealStatus];
