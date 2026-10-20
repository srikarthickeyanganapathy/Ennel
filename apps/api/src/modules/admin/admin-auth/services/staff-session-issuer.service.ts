import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type StaffSession } from '@ennel/shared';
import { APP_CONFIG, type AppConfig } from '../../../../config/app-config';
import { Clock } from '../../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { calculateRefreshExpiry } from '../../../auth/domain/refresh-rotation';
import { generateRefreshToken, hashRefreshToken } from '../../../auth/services/refresh-token';
import { type ClientMeta } from '../../../auth/services/student-session-issuer.service';
import { StaffSessionRepository } from '../repositories/staff-session.repository';
import { StaffAccessTokenService } from './staff-access-token.service';

export interface IssuedStaffSession {
  sessionId: string;
  session: StaffSession;
  /** Set as an httpOnly cookie by the controller; never in the JSON body (ADR-0015). */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface IssueOptions {
  staffId: string;
  mustChangePassword: boolean;
  meta: ClientMeta;
  familyId?: string;
  tx?: TransactionClient;
}

@Injectable()
export class StaffSessionIssuer {
  constructor(
    private readonly sessions: StaffSessionRepository,
    private readonly accessTokens: StaffAccessTokenService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(options: IssueOptions): Promise<IssuedStaffSession> {
    const now = this.clock.now();
    const sessionId = randomUUID();
    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = calculateRefreshExpiry(now, this.config.jwt.staffRefreshTtlDays);
    await this.sessions.create(
      {
        id: sessionId,
        staffUserId: options.staffId,
        familyId: options.familyId ?? randomUUID(),
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        ip: options.meta.ip,
        userAgent: options.meta.userAgent?.slice(0, 300),
      },
      options.tx,
    );
    const accessToken = await this.accessTokens.sign({
      staffId: options.staffId,
      sessionId,
      mustChangePassword: options.mustChangePassword,
    });
    const expiresAt = new Date(now.getTime() + this.config.jwt.accessTtlSeconds * 1000);
    return {
      sessionId,
      refreshToken,
      refreshTokenExpiresAt,
      session: {
        accessToken,
        accessTokenExpiresAt: expiresAt.toISOString(),
        mustChangePassword: options.mustChangePassword,
      },
    };
  }
}
