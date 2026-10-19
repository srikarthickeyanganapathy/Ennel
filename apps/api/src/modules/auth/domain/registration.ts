import { ErrorCode, RosterCheckStatus } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';

export interface RosterLookup {
  isActive: boolean;
  hasStudentAccount: boolean;
}

/**
 * Spec §3 Screen 2: only numbers in the authorized college roster are accepted; a registered
 * number is sent to the normal login flow.
 */
export function resolveRosterStatus(roster: RosterLookup | null): RosterCheckStatus {
  if (!roster || !roster.isActive) {
    throw new AppError(
      ErrorCode.ROSTER_NOT_FOUND,
      'We could not find this reference number. Check it or contact the mess office.',
    );
  }
  return roster.hasStudentAccount ? RosterCheckStatus.REGISTERED : RosterCheckStatus.NEW;
}

/** Spec §3 Screen 3: an account can be created only for an unregistered roster entry. */
export function assertCanRegister<T extends RosterLookup>(roster: T | null): asserts roster is T {
  if (resolveRosterStatus(roster) === RosterCheckStatus.REGISTERED) {
    throw new AppError(
      ErrorCode.ALREADY_REGISTERED,
      'An account already exists for this reference number. Please log in.',
    );
  }
}
