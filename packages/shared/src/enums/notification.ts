/** Spec §13 notification filters. */
export const NotificationCategory = {
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  BOOKING: 'BOOKING',
  REMINDER: 'REMINDER',
  WARNING: 'WARNING',
  LEAVE: 'LEAVE',
  COMPLAINT: 'COMPLAINT',
  MENU: 'MENU',
  NO_SHOW: 'NO_SHOW',
} as const;
export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];
