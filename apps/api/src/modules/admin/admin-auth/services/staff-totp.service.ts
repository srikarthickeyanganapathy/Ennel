import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErrorCode, type TotpEnrollment } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { SecretBox } from '../../../../infrastructure/crypto/secret-box';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { buildOtpauthUrl, verifyTotp } from '../domain/totp';
import { StaffAuthRepository } from '../repositories/staff-auth.repository';
import { requireMember } from './require-staff-member';

/** Optional TOTP 2FA (Admin §B): enrol, then confirm with a first valid code to switch it on. */
@Injectable()
export class StaffTotpService {
  constructor(
    private readonly staff: StaffAuthRepository,
    private readonly secretBox: SecretBox,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async startEnrollment(staffId: string): Promise<TotpEnrollment> {
    const member = await requireMember(this.staff, staffId);
    if (member.totpEnabled) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Two-factor sign-in is already on.');
    }
    const secret = randomBytes(20);
    await this.staff.setPendingTotpSecret(staffId, this.secretBox.seal(secret));
    const otpauthUrl = buildOtpauthUrl(secret, member.email);
    return { secret: new URL(otpauthUrl).searchParams.get('secret') ?? '', otpauthUrl };
  }

  async confirmEnrollment(staffId: string, code: string): Promise<void> {
    const member = await requireMember(this.staff, staffId);
    if (member.totpEnabled || !member.totpSecretEnc) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Start two-factor setup first.');
    }
    if (!verifyTotp(this.secretBox.open(member.totpSecretEnc), code, this.clock.now())) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'The code is incorrect or expired.', {
        issues: [{ path: 'code', message: 'The code is incorrect or expired' }],
      });
    }
    await this.transactions.run(async (tx) => {
      await this.staff.enableTotp(staffId, tx);
      await this.audit.write(tx, {
        action: 'staff.totp.enable',
        entityType: 'staff_user',
        entityId: staffId,
        before: { totpEnabled: false },
        after: { totpEnabled: true },
      });
    });
  }
}
