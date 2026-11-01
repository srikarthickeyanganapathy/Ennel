import { type Href } from 'expo-router';
import { type NotificationCategory, type StudentNotification } from '@ennel/shared';

export const CATEGORY_LABELS: Readonly<Record<NotificationCategory, string>> = {
  ANNOUNCEMENT: 'Announcement',
  BOOKING: 'Booking',
  REMINDER: 'Reminder',
  WARNING: 'Warning',
  LEAVE: 'Leave',
  COMPLAINT: 'Complaint',
  MENU: 'Menu',
  NO_SHOW: 'No-show',
};

/** The filters Spec §13 lists; reminders and menu changes show under "All". */
export const FILTERS: readonly { value: NotificationCategory | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
  { value: 'BOOKING', label: 'Bookings' },
  { value: 'WARNING', label: 'Warnings' },
  { value: 'NO_SHOW', label: 'No-shows' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'COMPLAINT', label: 'Complaints' },
];

export interface RelatedAction {
  label: string;
  href: Href;
}

/** Spec §13 "Related action button": where a notification's subject can be seen. */
export function relatedAction(notification: StudentNotification): RelatedAction | null {
  const id = notification.relatedEntityId;
  switch (notification.relatedEntityType) {
    case 'leave':
      return id
        ? { label: 'View Leave', href: { pathname: '/(student)/leave/[id]', params: { id } } }
        : null;
    case 'booking':
      return id
        ? {
            label: 'View Booking',
            href: { pathname: '/(student)/booking-record/[id]', params: { id } },
          }
        : null;
    case 'complaint':
      return id
        ? { label: 'View Report', href: { pathname: '/(student)/complaints/[id]', params: { id } } }
        : null;
    case 'no_show_appeal':
      return { label: 'View No-shows', href: '/(student)/no-shows' };
    case 'menu':
    case 'mess_closure':
      return { label: 'View Meals', href: '/(tabs)' };
    default:
      return null;
  }
}
