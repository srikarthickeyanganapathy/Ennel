import {
  type ComplaintCategory,
  type ComplaintStatus,
  type ComplaintType,
  type MealType,
} from '@ennel/shared';
import { type StatusTone } from '@/shared/components/StatusBadge';

export const TYPE_NAMES: Record<ComplaintType, string> = {
  COMPLAINT: 'Complaint',
  FEEDBACK: 'Feedback',
};
export const CATEGORY_NAMES: Record<ComplaintCategory, string> = {
  FOOD_QUALITY: 'Food quality',
  FOREIGN_OBJECT: 'Foreign object',
  CLEANLINESS: 'Cleanliness',
  SERVICE: 'Service',
  MENU: 'Menu',
  OTHER: 'Other',
};
export const MEAL_NAMES: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};
/** Admin UX: text labels with colour for statuses. */
export const STATUS: Record<ComplaintStatus, { label: string; tone: StatusTone }> = {
  NEW: { label: 'New', tone: 'info' },
  IN_REVIEW: { label: 'In review', tone: 'warning' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
};

/** BR-CMP-4, mirrored from the API so only valid next steps are offered. */
export const NEXT_STATUSES: Record<ComplaintStatus, ComplaintStatus[]> = {
  NEW: ['IN_REVIEW'],
  IN_REVIEW: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
};
