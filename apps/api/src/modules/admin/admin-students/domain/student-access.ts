import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';

export type StudentAccessAction = 'LOCK' | 'UNLOCK' | 'DEACTIVATE' | 'REACTIVATE';
type StudentStatus = 'ACTIVE' | 'LOCKED' | 'DEACTIVATED';

export interface StudentAccessState {
  isRegistered: boolean;
  status: StudentStatus | null;
  isRosterActive: boolean;
}

export interface StudentAccessChange {
  studentStatus: StudentStatus | null;
  isRosterActive: boolean;
  /** End the student's sessions so the change applies immediately. */
  shouldRevokeSessions: boolean;
}

/**
 * Admin §G lock/unlock and deactivate/reactivate. Lock is a temporary block on a registered
 * account; deactivation also marks the roster entry inactive, so an unregistered student
 * cannot register either.
 */
export function decideAccessChange(
  state: StudentAccessState,
  action: StudentAccessAction,
): StudentAccessChange {
  switch (action) {
    case 'LOCK':
      requireStatus(state, 'ACTIVE', 'Only an active, registered account can be locked.');
      return {
        studentStatus: 'LOCKED',
        isRosterActive: state.isRosterActive,
        shouldRevokeSessions: true,
      };
    case 'UNLOCK':
      requireStatus(state, 'LOCKED', 'This account is not locked.');
      return {
        studentStatus: 'ACTIVE',
        isRosterActive: state.isRosterActive,
        shouldRevokeSessions: false,
      };
    case 'DEACTIVATE':
      if (!state.isRosterActive && (!state.isRegistered || state.status === 'DEACTIVATED')) {
        throw invalid('This student is already deactivated.');
      }
      return {
        studentStatus: state.isRegistered ? 'DEACTIVATED' : null,
        isRosterActive: false,
        shouldRevokeSessions: state.isRegistered,
      };
    case 'REACTIVATE':
      if (state.isRosterActive && state.status !== 'DEACTIVATED')
        throw invalid('This student is not deactivated.');
      return {
        studentStatus: state.isRegistered ? 'ACTIVE' : null,
        isRosterActive: true,
        shouldRevokeSessions: false,
      };
  }
}

function requireStatus(state: StudentAccessState, status: StudentStatus, message: string): void {
  if (!state.isRegistered || state.status !== status) throw invalid(message);
}

function invalid(message: string): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message);
}
