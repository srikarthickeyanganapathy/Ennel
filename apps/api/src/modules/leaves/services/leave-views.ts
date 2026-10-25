import { countRange, type Leave, type MealPoint } from '@ennel/shared';
import { deriveLeaveState } from '../domain/leave-rules';
import { type LeaveRow } from '../repositories/leaves.repository';

/** A stored leave as the API shows it, with its derived state (BR-LEAVE-5). */
export function toLeave(row: LeaveRow, current: MealPoint): Leave {
  const state = deriveLeaveState(row, current);
  const { days, meals } = countRange(row.range);
  return {
    id: row.id,
    ...row.range,
    reason: row.reason,
    status: row.status,
    state,
    days,
    meals,
    rejectionReason: row.rejectionReason,
    isCreatedByStaff: row.isCreatedByStaff,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    version: row.version,
    canChange: state === 'PENDING' || state === 'UPCOMING' || state === 'ON_LEAVE',
  };
}
