import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { hash, verify } from 'argon2';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { isLockedOut, type LoginLockState } from '../../../auth/domain/login-lockout';
import { recordLoginFailure } from '../../../auth/services/record-login-failure';
import { type ClientMeta } from '../../../auth/services/student-session-issuer.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { StaffPermissionsService } from '../../rbac/services/staff-permissions.service';
import { findStaffPasswordProblem } from '../domain/staff-password-policy';
import { StaffAuthRepository } from '../repositories/staff-auth.repository';
import { StaffSessionRepository } from '../repositories/staff-session.repository';
import { type IssuedStaffSession, StaffSessionIssuer } from './staff-session-issuer.service';

export interface ChangeStaffPasswordCommand {
  currentPassword: string;
  newPassword: string;
}

/**
 * Own password change, also the forced first-login change (Admin §B). Every other session is
 * ended and this device gets a fresh one, all in one audited transaction.
 */
@Injectable()
export class ChangeStaffPasswordService {
  constructor(
    private readonly staff: StaffAuthRepository,
    private readonly sessions: StaffSessionRepository,
    private readonly issuer: StaffSessionIssuer,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly permissions: StaffPermissionsService,
    private readonly clock: Clock,
  ) {}

  async execute(
    staffId: string,
    command: ChangeStaffPasswordCommand,
    meta: ClientMeta,
  ): Promise<IssuedStaffSession> {
    const member = await this.staff.findById(staffId);
    if (!member) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Please sign in again.');
    const now = this.clock.now();
    if (isLockedOut(member, now)) throw locked(member.lockedUntil);
    if (!(await verify(member.passwordHash, command.currentPassword))) {
      await this.recordWrongPassword(staffId, member, now);
    }
    const problem = findStaffPasswordProblem(command.newPassword, member.email);
    if (problem) throw validation('newPassword', problem);
    if (await verify(member.passwordHash, command.newPassword)) {
      throw validation('newPassword', 'Choose a password different from the current one');
    }

    const passwordHash = await hash(command.newPassword);
    const issued = await this.transactions.run(async (tx) => {
      await this.staff.setPassword(staffId, passwordHash, now, tx);
      await this.sessions.revokeAllForStaff(staffId, now, tx);
      await this.audit.write(tx, {
        action: 'staff.password.change',
        entityType: 'staff_user',
        entityId: staffId,
        before: { mustChangePassword: member.mustChangePassword },
        after: { mustChangePassword: false },
      });
      return this.issuer.issue({ staffId, mustChangePassword: false, meta, tx });
    });
    this.permissions.invalidate(staffId);
    return issued;
  }

  /**
   * A wrong current password counts towards the sign-in lockout (BR-AUTH-3), so a stolen
   * session cannot be used to guess the password. Reaching the limit also ends every session.
   */
  private async recordWrongPassword(
    staffId: string,
    member: LoginLockState,
    now: Date,
  ): Promise<never> {
    const next = await recordLoginFailure(this.staff, staffId, member, now);
    if (isLockedOut(next, now)) {
      await this.sessions.revokeAllForStaff(staffId, now);
      throw locked(next.lockedUntil);
    }
    throw validation('currentPassword', 'Your current password is incorrect');
  }
}

function locked(lockedUntil: Date | null): AppError {
  return new AppError(ErrorCode.ACCOUNT_LOCKED, 'Too many failed attempts. Try again later.', {
    lockedUntil: lockedUntil?.toISOString(),
  });
}

function validation(path: string, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message, { issues: [{ path, message }] });
}
