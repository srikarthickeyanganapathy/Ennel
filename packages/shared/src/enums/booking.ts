/** Rule 2. */
export const BookingSource = {
  DEFAULT: 'DEFAULT',
  MANUAL: 'MANUAL',
  PLAN_AHEAD_DATE: 'PLAN_AHEAD_DATE',
  PLAN_AHEAD_WEEKDAY: 'PLAN_AHEAD_WEEKDAY',
  ADMIN: 'ADMIN',
} as const;
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];

/** Rule 3. Display labels are derived (BR-BOOK-3), never stored. */
export const BookingStatus = {
  BOOKED: 'BOOKED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  PAUSED_LEAVE: 'PAUSED_LEAVE',
  CANCELLED_BY_CLOSURE: 'CANCELLED_BY_CLOSURE',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const DateExceptionAction = {
  BOOK: 'BOOK',
  SKIP: 'SKIP',
} as const;
export type DateExceptionAction = (typeof DateExceptionAction)[keyof typeof DateExceptionAction];

/** Rule 7, BR-CAP-5. */
export const AvailabilityLabel = {
  AVAILABLE: 'AVAILABLE',
  FILLING_FAST: 'FILLING_FAST',
  FULL: 'FULL',
  RECOMMENDED: 'RECOMMENDED',
  OVER_CAPACITY: 'OVER_CAPACITY',
} as const;
export type AvailabilityLabel = (typeof AvailabilityLabel)[keyof typeof AvailabilityLabel];

export const ActorType = {
  STUDENT: 'STUDENT',
  STAFF: 'STAFF',
  SYSTEM: 'SYSTEM',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];
