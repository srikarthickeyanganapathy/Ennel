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
}

@Injectable()
export class StudentAccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sign(studentId: string): Promise<string> {
    return this.jwt.signAsync(
      { typ: STUDENT_SUBJECT_TYPE },
      {
        secret: this.config.jwt.studentSecret,
        audience: STUDENT_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
        subject: studentId,
        expiresIn: this.config.jwt.accessTtlSeconds,
      },
    );
  }

  /** Student ID for a valid token, otherwise null. */
  async verify(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<StudentTokenPayload>(token, {
        secret: this.config.jwt.studentSecret,
        audience: STUDENT_TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
      });
      return payload.typ === STUDENT_SUBJECT_TYPE ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
