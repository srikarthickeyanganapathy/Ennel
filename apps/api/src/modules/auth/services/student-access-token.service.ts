import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';

/** Student tokens use their own secret and audience, so they never pass staff guards (ADR-0015). */
export const STUDENT_TOKEN_AUDIENCE = 'ennel-student';
export const TOKEN_ISSUER = 'ennel-api';
const STUDENT_SUBJECT_TYPE = 'student';

interface StudentTokenPayload {
  sub: string;
  typ: string;
  /** Session row, checked on every request so a revoked session ends at once. */
  sid?: string;
}

export interface StudentTokenClaims {
  studentId: string;
  sessionId: string;
}

@Injectable()
export class StudentAccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sign(studentId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { typ: STUDENT_SUBJECT_TYPE, sid: sessionId },
      {
        secret: this.config.jwt.studentSecret,
        audience: STUDENT_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
        subject: studentId,
        expiresIn: this.config.jwt.accessTtlSeconds,
      },
    );
  }

  /** Claims of a valid token, otherwise null. Tokens issued without a session id are refused. */
  async verify(token: string): Promise<StudentTokenClaims | null> {
    try {
      const payload = await this.jwt.verifyAsync<StudentTokenPayload>(token, {
        secret: this.config.jwt.studentSecret,
        audience: STUDENT_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
      });
      if (payload.typ !== STUDENT_SUBJECT_TYPE || !payload.sid) return null;
      return { studentId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  }
}
