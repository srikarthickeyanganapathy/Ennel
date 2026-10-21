import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { SecretBox } from '../../../../infrastructure/crypto/secret-box';
import { isLockedOut, recordSuccessfulLogin } from '../../../auth/domain/login-lockout';
import { recordLoginFailure } from '../../../auth/services/record-login-failure';
import { type ClientMeta } from '../../../auth/services/student-session-issuer.service';
import { verifyTotp } from '../domain/totp';
import { StaffAuthRepository } from '../repositories/staff-auth.repository';
import { assertCanAttempt } from './login-staff.service';
import { StaffAccessTokenService } from './staff-access-token.service';
import { type IssuedStaffSession, StaffSessionIssuer } from './staff-session-issuer.service';

/** Second login step when TOTP is enabled. Wrong codes count towards the same lockout. */
@Injectable()
export class VerifyTotpLoginService {
  constructor(
    private readonly staff: StaffAuthRepository,
    private readonly tokens: StaffAccessTokenService,
    private readonly issuer: StaffSessionIssuer,
    private readonly secretBox: SecretBox,
    private readonly clock: Clock,
  ) {}

  async execute(
    challengeToken: string,
    code: string,
    meta: ClientMeta,
  ): Promise<IssuedStaffSession> {
    const staffId = await this.tokens.verifyTotpChallenge(challengeToken);
    const member = staffId ? await this.staff.findById(staffId) : null;
    if (!member || !member.totpEnabled || !member.totpSecretEnc) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign-in expired. Please start again.');
    }
    const now = this.clock.now();
    assertCanAttempt(member, now);
    if (!verifyTotp(this.secretBox.open(member.totpSecretEnc), code, now)) {
      const next = await recordLoginFailure(this.staff, member.id, member, now);
      throw new AppError(
        isLockedOut(next, now) ? ErrorCode.ACCOUNT_LOCKED : ErrorCode.INVALID_CREDENTIALS,
        'The code is incorrect or expired.',
      );
    }
    await this.staff.saveLoginState(member.id, recordSuccessfulLogin());
    return this.issuer.issue({
      staffId: member.id,
      mustChangePassword: member.mustChangePassword,
      meta,
    });
  }
}
