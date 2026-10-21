import { Injectable } from '@nestjs/common';
import { type AuthSession, ErrorCode } from '@ennel/shared';
import { hash, verify } from 'argon2';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { isTicketUsable } from '../domain/credential-reset';
import {
  CredentialResetRepository,
  type StoredResetTicket,
} from '../repositories/credential-reset.repository';
import { StudentAuthRepository } from '../repositories/student-auth.repository';
import { StudentSessionRepository } from '../repositories/student-session.repository';
import { type ClientMeta, StudentSessionIssuer } from './student-session-issuer.service';

export interface ResetWithCodeCommand {
  referenceNumber: string;
  code: string;
  password: string;
}

const INVALID = 'The reference number or reset code is incorrect or has expired.';

/**
 * Student redeems a staff-issued code (ADR-0019): sets a new password, ends every other
 * session and signs in. A REGISTRATION reset also sends the student through setup again.
 */
@Injectable()
export class ResetWithCodeService {
  constructor(
    private readonly students: StudentAuthRepository,
    private readonly tickets: CredentialResetRepository,
    private readonly sessions: StudentSessionRepository,
    private readonly issuer: StudentSessionIssuer,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(command: ResetWithCodeCommand, meta: ClientMeta): Promise<AuthSession> {
    const student = await this.students.findCredentials(command.referenceNumber);
    if (!student) throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID);
    if (student.status !== 'ACTIVE') {
      throw new AppError(
        ErrorCode.ACCOUNT_LOCKED,
        'This account is not active. Please contact the mess office.',
      );
    }
    const now = this.clock.now();
    const ticket = await this.tickets.findLatest(student.id);
    await this.assertCodeMatches(ticket, command.code, now);
    if (!ticket) throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID);

    const passwordHash = await hash(command.password);
    const clearsOnboarding = ticket.kind === 'REGISTRATION';
    return this.transactions.run(async (tx) => {
      if (!(await this.tickets.markUsed(ticket.id, now, tx))) {
        throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID);
      }
      await this.students.resetPassword(student.id, passwordHash, clearsOnboarding, tx);
      await this.sessions.revokeAllForStudent(student.id, now, tx);
      const issued = await this.issuer.issue({
        studentId: student.id,
        isOnboardingComplete: student.isOnboardingComplete && !clearsOnboarding,
        meta,
        tx,
      });
      return issued.session;
    });
  }

  private async assertCodeMatches(
    ticket: StoredResetTicket | null,
    code: string,
    now: Date,
  ): Promise<void> {
    const isUsable =
      ticket !== null &&
      isTicketUsable(ticket, now) &&
      (await this.tickets.claimAttempt(ticket.id, now));
    if (!isUsable) throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID);
    // The attempt is already counted, so a wrong code needs no further write.
    if (!(await verify(ticket.codeHash, code))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID);
    }
  }
}
