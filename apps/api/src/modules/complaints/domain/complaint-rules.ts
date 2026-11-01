import { type ComplaintPrivacyMode, type ComplaintStatus } from '@ennel/shared';

/** BR-CMP-4: `NEW → IN_REVIEW → RESOLVED | REJECTED`; closed reports stay closed. */
const NEXT_STATUSES: Readonly<Record<ComplaintStatus, readonly ComplaintStatus[]>> = {
  NEW: ['IN_REVIEW'],
  IN_REVIEW: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
};

export function canChangeStatus(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return NEXT_STATUSES[from].includes(to);
}

export function nextStatuses(from: ComplaintStatus): readonly ComplaintStatus[] {
  return NEXT_STATUSES[from];
}

export function isClosedStatus(status: ComplaintStatus): boolean {
  return status === 'RESOLVED' || status === 'REJECTED';
}

/**
 * BR-CMP-2, ADR-0008: what is stored about the submitter, decided by the mode at submission.
 * Anonymous reports keep neither the student nor the hostel, since a small block could identify them.
 */
export function submitterSnapshot(
  mode: ComplaintPrivacyMode,
  student: { id: string; hostelBlockId: string | null },
): { studentId: string | null; hostelBlockId: string | null } {
  if (mode === 'ANONYMOUS') return { studentId: null, hostelBlockId: null };
  return { studentId: student.id, hostelBlockId: student.hostelBlockId };
}

/** Readable reference without look-alike characters (Spec §12 "complaint reference"). */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Builds `CMP-XXXXXX` from caller-supplied random bytes, so this stays pure and testable. */
export function referenceCodeFrom(randomBytes: Uint8Array): string {
  const characters = Array.from(randomBytes.subarray(0, 6), (byte) => {
    return REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length] ?? 'X';
  });
  return `CMP-${characters.join('')}`;
}
