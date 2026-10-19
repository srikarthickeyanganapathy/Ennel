import { Injectable } from '@nestjs/common';
import { type AuthSession, ErrorCode } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { decideRefresh } from '../domain/refresh-rotation';
import { StudentAuthRepository } from '../repositories/student-auth.repository';
import {
  type StoredStudentSession,
  StudentSessionRepository,
} from '../repositories/student-session.repository';
import { hashRefreshToken } from './refresh-token';
import { type ClientMeta, StudentSessionIssuer } from './student-session-issuer.service';

const SESSION_ENDED = 'Your session has ended. Please log in again.';

/** Refresh-token rotation with reuse detection (Rule 11, ADR-0015). */
@Injectable()
export class RefreshStudentSessionService {
  constructor(
    private readonly sessions: StudentSessionRepository,
    private readonly students: StudentAuthRepository,
    private readonly issuer: StudentSessionIssuer,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string, meta: ClientMeta): Promise<AuthSession> {
    const now = this.clock.now();
    const stored = await this.sessions.findByTokenHash(hashRefreshToken(refreshToken));
    if (!stored) throw new AppError(ErrorCode.UNAUTHENTICATED, SESSION_ENDED);

    const decision = decideRefresh(stored, now);
    if (decision === 'REUSE_DETECTED') await this.sessions.revokeFamily(stored.familyId, now);
    if (decision !== 'ROTATE') throw new AppError(ErrorCode.UNAUTHENTICATED, SESSION_ENDED);

    const student = await this.students.findCredentialsById(stored.studentId);
    if (!student || student.status !== 'ACTIVE') {
      await this.sessions.revokeFamily(stored.familyId, now);
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, 'This account is not active.');
    }
    return this.rotate(stored, student.isOnboardingComplete, meta, now);
  }

  private async rotate(
    stored: StoredStudentSession,
    isOnboardingComplete: boolean,
    meta: ClientMeta,
    now: Date,
  ): Promise<AuthSession> {
    const rotated = await this.transactions
      .run(async (tx) => {
        const issued = await this.issuer.issue({
          studentId: stored.studentId,
          familyId: stored.familyId,
          isOnboardingComplete,
          meta,
          tx,
        });
        // Losing this race means another request already used the token: treat as reuse.
        const isFirstUse = await this.sessions.markReplaced(stored.id, issued.sessionId, now, tx);
        if (!isFirstUse) throw new AppError(ErrorCode.UNAUTHENTICATED, SESSION_ENDED);
        return issued.session;
      })
      .catch(async (error: unknown) => {
        if (error instanceof AppError) await this.sessions.revokeFamily(stored.familyId, now);
        throw error;
      });
    return rotated;
  }
}
