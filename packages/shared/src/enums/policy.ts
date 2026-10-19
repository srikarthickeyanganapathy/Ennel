/** ADR-0006. */
export const SlotFullFallback = {
  AUTO_NEXT_AVAILABLE: 'AUTO_NEXT_AVAILABLE',
  ASK_STUDENT: 'ASK_STUDENT',
} as const;
export type SlotFullFallback = (typeof SlotFullFallback)[keyof typeof SlotFullFallback];

/** ADR-0008. */
export const ComplaintPrivacyMode = {
  ANONYMOUS: 'ANONYMOUS',
  PRIVATE_IDENTIFIED: 'PRIVATE_IDENTIFIED',
} as const;
export type ComplaintPrivacyMode = (typeof ComplaintPrivacyMode)[keyof typeof ComplaintPrivacyMode];
