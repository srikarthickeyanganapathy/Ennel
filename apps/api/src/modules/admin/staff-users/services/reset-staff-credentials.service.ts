import { Injectable } from '@nestjs/common';
import { type StaffWithTemporaryPassword } from '@ennel/shared';
import { hash } from 'argon2';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { StaffSessionsService } from '../../admin-auth/services/staff-sessions.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { StaffUsersRepository } from '../repositories/staff-users.repository';
import { requireStaff } from './staff-lookup';
import { generateTemporaryPassword } from './temporary-password';

/**
 * Admin-initiated credential resets for staff. A reset password is shown once and must be
 * changed at next sign-in; resetting 2FA lets someone who lost their device enrol again.
 * Both end the staff member's sessions.
 */
@Injectable()
export class ResetStaffCredentialsService {
  constructor(
    private readonly staff: StaffUsersRepository,
    private readonly sessions: StaffSessionsService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  async resetPassword(staffId: string, reason: string): Promise<StaffWithTemporaryPassword> {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hash(temporaryPassword);
    const staff = await this.transactions.run(async (tx) => {
      await requireStaff(this.staff, staffId, tx);
      await this.staff.setTemporaryPassword(staffId, passwordHash, tx);
      await this.sessions.revokeAllWithin(tx, staffId);
      await this.audit.write(tx, {
        action: 'staff.password.reset',
        entityType: 'staff_user',
        entityId: staffId,
        after: { mustChangePassword: true },
        reason,
      });
      return requireStaff(this.staff, staffId, tx);
    });
    return { staff, temporaryPassword };
  }

  resetTotp(staffId: string, reason: string): Promise<void> {
    return this.transactions.run(async (tx) => {
      const before = await requireStaff(this.staff, staffId, tx);
      await this.staff.resetTotp(staffId, tx);
      await this.sessions.revokeAllWithin(tx, staffId);
      await this.audit.write(tx, {
        action: 'staff.totp.reset',
        entityType: 'staff_user',
        entityId: staffId,
        before: { totpEnabled: before.totpEnabled },
        after: { totpEnabled: false },
        reason,
      });
    });
  }
}
