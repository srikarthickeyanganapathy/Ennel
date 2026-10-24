import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { hash, verify } from 'argon2';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { isLockedOut, recordSuccessfulLogin } from '../../../auth/domain/login-lockout';
import { recordLoginFailure } from '../../../auth/services/record-login-failure';
import { type ClientMeta } from '../../../auth/services/student-session-issuer.service';
import { type StaffCredentials, StaffAuthRepository } from '../repositories/staff-auth.repository';
import { StaffAccessTokenService } from './staff-access-token.service';
import { type IssuedStaffSession, StaffSessionIssuer } from './staff-session-issuer.service';

export type StaffLoginResult =
  | { status: 'AUTHENTICATED'; issued: IssuedStaffSession }
  | { status: 'TOTP_REQUIRED'; challengeToken: string };

const INVALID_CREDENTIALS = 'The email or password is incorrect.';

/** Staff login (Admin §B): separate from students, with lockout and optional TOTP. */
@Injectable()
export class LoginStaffService {
  private timingHash?: Promise<string>;

  constructor(
    private readonly staff: StaffAuthRepository,
    private readonly issuer: StaffSessionIssuer,
    private readonly tokens: StaffAccessTokenService,
    private readonly clock: Clock,
  ) {}

  async execute(email: string, password: string, meta: ClientMeta): Promise<StaffLoginResult> {
    const member = await this.staff.findByEmail(email);
    if (!member || member.isDeleted) {
      await this.spendEquivalentTime(password);
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID_CREDENTIALS);
    }
    const now = this.clock.now();
    if (isLockedOut(member, now)) throw lockedError(member.lockedUntil);
    if (!(await verify(member.passwordHash, password))) await this.handleFailure(member, now);
    // A disabled account is revealed only after the right password (BR-AUTH-9).
    assertCanAttempt(member, now);

    // With 2FA the counter is cleared only once the code is correct: resetting it here would let
    // anyone who knows the password retry TOTP codes forever (BR-AUTH-3).
    if (member.totpEnabled) {
      return {
        status: 'TOTP_REQUIRED',
        challengeToken: await this.tokens.signTotpChallenge(member.id),
      };
    }
    await this.staff.saveLoginState(member.id, recordSuccessfulLogin());
    const issued = await this.issuer.issue({
      staffId: member.id,
      mustChangePassword: member.mustChangePassword,
      meta,
    });
    return { status: 'AUTHENTICATED', issued };
  }

  private async handleFailure(member: StaffCredentials, now: Date): Promise<never> {
    const next = await recordLoginFailure(this.staff, member.id, member, now);
    if (isLockedOut(next, now)) throw lockedError(next.lockedUntil);
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID_CREDENTIALS);
  }

  private async spendEquivalentTime(password: string): Promise<void> {
    this.timingHash ??= hash('timing-equalizer-not-a-real-password');
    await verify(await this.timingHash, password);
  }
}

export function assertCanAttempt(member: StaffCredentials, now: Date): void {
  if (member.status !== 'ACTIVE') {
    throw new AppError(
      ErrorCode.ACCOUNT_LOCKED,
      'This account is disabled. Contact a Super Admin.',
    );
  }
  if (isLockedOut(member, now)) throw lockedError(member.lockedUntil);
}

function lockedError(lockedUntil: Date | null): AppError {
  return new AppError(ErrorCode.ACCOUNT_LOCKED, 'Too many failed attempts. Try again later.', {
    lockedUntil: lockedUntil?.toISOString(),
  });
}
