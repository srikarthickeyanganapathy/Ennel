import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../../../../config/app-config';
import { TOKEN_ISSUER } from '../../../auth/services/student-access-token.service';

/** Staff tokens use their own secret and audience, so they never pass student guards (ADR-0015). */
export const STAFF_TOKEN_AUDIENCE = 'ennel-staff';
const TOTP_CHALLENGE_AUDIENCE = 'ennel-staff-totp';
const TOTP_CHALLENGE_TTL_SECONDS = 5 * 60;
const STAFF_SUBJECT_TYPE = 'staff';

export interface StaffTokenClaims {
  staffId: string;
  sessionId: string;
  mustChangePassword: boolean;
}

interface StaffTokenPayload {
  sub: string;
  typ: string;
  sid: string;
  pwc: boolean;
}

@Injectable()
export class StaffAccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sign(claims: StaffTokenClaims): Promise<string> {
    return this.jwt.signAsync(
      { typ: STAFF_SUBJECT_TYPE, sid: claims.sessionId, pwc: claims.mustChangePassword },
      {
        secret: this.config.jwt.staffSecret,
        audience: STAFF_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
        subject: claims.staffId,
        expiresIn: this.config.jwt.accessTtlSeconds,
      },
    );
  }

  async verify(token: string): Promise<StaffTokenClaims | null> {
    try {
      const payload = await this.jwt.verifyAsync<StaffTokenPayload>(token, {
        secret: this.config.jwt.staffSecret,
        audience: STAFF_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
      });
      if (payload.typ !== STAFF_SUBJECT_TYPE) return null;
      return { staffId: payload.sub, sessionId: payload.sid, mustChangePassword: payload.pwc };
    } catch {
      return null;
    }
  }

  /** Short-lived proof that the password step passed, exchanged for a session after TOTP. */
  signTotpChallenge(staffId: string): Promise<string> {
    return this.jwt.signAsync(
      { typ: STAFF_SUBJECT_TYPE },
      {
        secret: this.config.jwt.staffSecret,
        audience: TOTP_CHALLENGE_AUDIENCE,
        issuer: TOKEN_ISSUER,
        subject: staffId,
        expiresIn: TOTP_CHALLENGE_TTL_SECONDS,
      },
    );
  }

  async verifyTotpChallenge(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.jwt.staffSecret,
        audience: TOTP_CHALLENGE_AUDIENCE,
        issuer: TOKEN_ISSUER,
      });
      return payload.sub;
    } catch {
      return null;
    }
  }
}
