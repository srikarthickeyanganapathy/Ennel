import { createHash } from 'node:crypto';
import { type StudentComplaint } from '@ennel/shared';
import { type ComplaintRow } from '../repositories/complaints.repository';

/** The student's view: no notes, assignee or identity (BR-CMP-1). */
export function toStudentComplaint(row: ComplaintRow): StudentComplaint {
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    type: row.type,
    category: row.category,
    mealType: row.mealType,
    mealDate: row.mealDate,
    description: row.description,
    status: row.status,
    response: row.response,
    photoCount: row.photoCount,
    privacyMode: row.privacyMode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Receipt tokens are random 256-bit values, so a plain SHA-256 is enough to store them. */
export function hashReceiptToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
