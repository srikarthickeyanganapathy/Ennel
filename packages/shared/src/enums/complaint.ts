/** Spec §12, Admin §L. */
export const ComplaintType = {
  COMPLAINT: 'COMPLAINT',
  FEEDBACK: 'FEEDBACK',
} as const;
export type ComplaintType = (typeof ComplaintType)[keyof typeof ComplaintType];

export const ComplaintCategory = {
  FOOD_QUALITY: 'FOOD_QUALITY',
  FOREIGN_OBJECT: 'FOREIGN_OBJECT',
  CLEANLINESS: 'CLEANLINESS',
  SERVICE: 'SERVICE',
  MENU: 'MENU',
  OTHER: 'OTHER',
} as const;
export type ComplaintCategory = (typeof ComplaintCategory)[keyof typeof ComplaintCategory];

export const ComplaintStatus = {
  NEW: 'NEW',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;
export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus];
