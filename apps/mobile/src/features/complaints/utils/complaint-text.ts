import {
  type ComplaintCategory,
  type ComplaintPrivacyMode,
  type ComplaintStatus,
  type ComplaintType,
} from '@ennel/shared';

export const TYPE_LABELS: Readonly<Record<ComplaintType, string>> = {
  COMPLAINT: 'Complaint',
  FEEDBACK: 'Feedback',
};

export const CATEGORY_LABELS: Readonly<Record<ComplaintCategory, string>> = {
  FOOD_QUALITY: 'Food quality',
  FOREIGN_OBJECT: 'Foreign object in food',
  CLEANLINESS: 'Cleanliness',
  SERVICE: 'Service',
  MENU: 'Menu',
  OTHER: 'Other',
};

/** Spec §14: status in words as well as colour. */
export const STATUS_TEXT: Readonly<Record<ComplaintStatus, { label: string; className: string }>> =
  {
    NEW: { label: 'Received', className: 'text-primary' },
    IN_REVIEW: { label: 'In review', className: 'text-warning' },
    RESOLVED: { label: 'Resolved', className: 'text-success' },
    REJECTED: { label: 'Not upheld', className: 'text-danger' },
  };

/**
 * Spec §12: "do not promise anonymity if the backend retains identifying data", so the wording
 * follows the stored mode exactly (ADR-0008).
 */
export function privacyNote(mode: ComplaintPrivacyMode): string {
  return mode === 'ANONYMOUS'
    ? 'Your name is not stored with this report. Only this phone can show its status, and you will not get notifications about it.'
    : 'Your name is kept private: other students never see your report, and only mess office staff can see who sent it so they can follow up.';
}
