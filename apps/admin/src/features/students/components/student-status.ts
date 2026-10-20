import { type AdminStudentListItem } from '@ennel/shared';
import { type StatusTone } from '@/shared/components/StatusBadge';

/** One label for registration and account state, shown with text and colour. */
export function describeStudentStatus(
  student: Pick<AdminStudentListItem, 'isRegistered' | 'status' | 'isRosterActive'>,
): {
  label: string;
  tone: StatusTone;
} {
  if (!student.isRosterActive || student.status === 'DEACTIVATED')
    return { label: 'Deactivated', tone: 'danger' };
  if (!student.isRegistered) return { label: 'Not registered', tone: 'neutral' };
  if (student.status === 'LOCKED') return { label: 'Locked', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}
