import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { decideRefresh } from '../../../auth/domain/refresh-rotation';
import { hashRefreshToken } from '../../../auth/services/refresh-token';
import { type ClientMeta } from '../../../auth/services/student-session-issuer.service';
import { StaffAuthRepository } from '../repositories/staff-auth.repository';
import { StaffSessionRepository } from '../repositories/staff-session.repository';
import { type IssuedStaffSession, StaffSessionIssuer } from './staff-session-issuer.service';

const SESSION_ENDED = 'Your session has ended. Please sign in again.';

/** Staff refresh-token rotation with reuse detection (Admin §B, ADR-0015). */
@Injectable()
export class RefreshStaffSessionService {
  constructor(
    private readonly sessions: StaffSessionRepository,
    private readonly staff: StaffAuthRepository,
    private readonly issuer: StaffSessionIssuer,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string | null, meta: ClientMeta): Promise<IssuedStaffSession> {
    const now = this.clock.now();
    const stored = refreshToken
      ? await this.sessions.findByTokenHash(hashRefreshToken(refreshToken))
      : null;
    if (!stored) throw new AppError(ErrorCode.UNAUTHENTICATED, SESSION_ENDED);

    const decision = decideRefresh(stored, now);
    if (decision === 'REUSE_DETECTED') await this.sessions.revokeFamily(stored.familyId, now);
    if (decision !== 'ROTATE') throw new AppError(ErrorCode.UNAUTHENTICATED, SESSION_ENDED);

    const member = await this.staff.findById(stored.staffUserId);
    if (!member || member.isDeleted || member.status !== 'ACTIVE') {
      await this.sessions.revokeFamily(stored.familyId, now);
      throw new AppError(ErrorCode.UNAUTHENTICATED, SESSION_ENDED);
    }
    try {
      return await this.transactions.run(async (tx) => {
        const issued = await this.issuer.issue({
          staffId: member.id,
          mustChangePassword: member.mustChangePassword,
          familyId: stored.familyId,
          meta,
          tx,
        });
        if (!(await this.sessions.markReplaced(stored.id, issued.sessionId, now, tx))) {
          throw new AppError(ErrorCode.UNAUTHENTICATED, SESSION_ENDED);
        }
        return issued;
      });
    } catch (error) {
      if (error instanceof AppError) await this.sessions.revokeFamily(stored.familyId, now);
      throw error;
    }
  }
}
