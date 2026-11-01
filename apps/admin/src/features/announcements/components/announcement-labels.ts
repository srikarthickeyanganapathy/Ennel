import {
  type Announcement,
  type ANNOUNCEMENT_AUDIENCES,
  type ANNOUNCEMENT_CATEGORIES,
  type ANNOUNCEMENT_STATUSES,
} from '@ennel/shared';
import { type StatusTone } from '@/shared/components/StatusBadge';

type Status = (typeof ANNOUNCEMENT_STATUSES)[number];
type Category = (typeof ANNOUNCEMENT_CATEGORIES)[number];
type AudienceType = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const STATUS: Record<Status, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  SENDING: { label: 'Sending', tone: 'warning' },
  SENT: { label: 'Sent', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const CATEGORY_NAMES: Record<Category, string> = {
  GENERAL: 'General',
  MENU: 'Menu',
  TIMING: 'Timing',
  EVENT: 'Event',
  URGENT: 'Urgent',
};

export const AUDIENCE_NAMES: Record<AudienceType, string> = {
  ALL: 'All students',
  HOSTEL: 'Hostels',
  BLOCK: 'Blocks',
  ACADEMIC_YEAR: 'Academic years',
  CUSTOM: 'Custom list',
};

export function describeAudience(audience: Announcement['audience']): string {
  switch (audience.type) {
    case 'ALL':
      return 'All students';
    case 'HOSTEL':
      return `${audience.hostelIds.length} hostel(s)`;
    case 'BLOCK':
      return `${audience.blockIds.length} block(s)`;
    case 'ACADEMIC_YEAR':
      return `Year ${audience.academicYears.join(', ')}`;
    case 'CUSTOM':
      return `${audience.referenceNumbers.length} student(s) by reference number`;
  }
}

export const isEditable = (status: Status) => status === 'DRAFT' || status === 'SCHEDULED';

/** `datetime-local` has no time zone; the mess runs on IST, so the value is read as IST. */
export const istInputToIso = (value: string): string => new Date(`${value}:00+05:30`).toISOString();
