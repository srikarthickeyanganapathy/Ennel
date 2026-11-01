import {
  type announcementAudienceSchema,
  type ANNOUNCEMENT_STATUSES,
  normalizeReferenceNumber,
} from '@ennel/shared';
import { type z } from 'zod';

export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];
export type Audience = z.output<typeof announcementAudienceSchema>;

/** Admin §M "edit before send": drafts and scheduled announcements can change; sent ones cannot. */
export function isEditable(status: AnnouncementStatus): boolean {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

/** Returns why the audience cannot be used, or null. Each targeted type needs a target. */
export function audienceProblem(audience: Audience): string | null {
  const missing: Record<Audience['type'], boolean> = {
    ALL: false,
    HOSTEL: audience.hostelIds.length === 0,
    BLOCK: audience.blockIds.length === 0,
    ACADEMIC_YEAR: audience.academicYears.length === 0,
    CUSTOM: audience.referenceNumbers.length === 0,
  };
  if (!missing[audience.type]) return null;
  const words: Record<Audience['type'], string> = {
    ALL: '',
    HOSTEL: 'Choose at least one hostel.',
    BLOCK: 'Choose at least one block.',
    ACADEMIC_YEAR: 'Choose at least one academic year.',
    CUSTOM: 'Add at least one reference number.',
  };
  return words[audience.type];
}

/** Keeps only the targets that apply to the chosen type, so a stored audience is unambiguous. */
export function normaliseAudience(audience: Audience): Audience {
  const references = [...new Set(audience.referenceNumbers.map(normalizeReferenceNumber))];
  return {
    type: audience.type,
    hostelIds: audience.type === 'HOSTEL' ? [...new Set(audience.hostelIds)] : [],
    blockIds: audience.type === 'BLOCK' ? [...new Set(audience.blockIds)] : [],
    academicYears: audience.type === 'ACADEMIC_YEAR' ? [...new Set(audience.academicYears)] : [],
    referenceNumbers: audience.type === 'CUSTOM' ? references : [],
  };
}

/** A schedule must be at least a minute ahead, so the worker cannot miss or race it. */
export const MIN_SCHEDULE_LEAD_MS = 60_000;

export function isScheduleValid(scheduledFor: Date, now: Date): boolean {
  return scheduledFor.getTime() - now.getTime() >= MIN_SCHEDULE_LEAD_MS;
}
