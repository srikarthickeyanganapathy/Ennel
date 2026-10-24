import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type AuthSession } from '@ennel/shared';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { calculateRefreshExpiry } from '../domain/refresh-rotation';
import { StudentSessionRepository } from '../repositories/student-session.repository';
import { generateRefreshToken, hashRefreshToken } from './refresh-token';
import { StudentAccessTokenService } from './student-access-token.service';

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

interface IssueOptions {
  studentId: string;
  isOnboardingComplete: boolean;
  meta: ClientMeta;
  /** Continue an existing family on rotation; omit to start a new login. */
  familyId?: string;
  tx?: TransactionClient;
}

export interface IssuedSession {
  sessionId: string;
  session: AuthSession;
}

@Injectable()
export class StudentSessionIssuer {
  constructor(
    private readonly sessions: StudentSessionRepository,
    private readonly accessTokens: StudentAccessTokenService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(options: IssueOptions): Promise<IssuedSession> {
    const now = this.clock.now();
    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = calculateRefreshExpiry(now, this.config.jwt.refreshTtlDays);
    const { id } = await this.sessions.create(
      {
        studentId: options.studentId,
        familyId: options.familyId ?? randomUUID(),
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        ip: options.meta.ip,
        userAgent: options.meta.userAgent?.slice(0, 300),
      },
      options.tx,
    );
    const accessTokenExpiresAt = new Date(now.getTime() + this.config.jwt.accessTtlSeconds * 1000);
    return {
      sessionId: id,
      session: {
        accessToken: await this.accessTokens.sign(options.studentId, id),
        accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
        refreshToken,
        refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
        isOnboardingComplete: options.isOnboardingComplete,
      },
    };
  }
}
