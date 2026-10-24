import { Injectable } from '@nestjs/common';
import { type AuthSession, ErrorCode } from '@ennel/shared';
import { hash, verify } from 'argon2';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { isLockedOut, recordSuccessfulLogin } from '../domain/login-lockout';
import {
  type StudentCredentials,
  StudentAuthRepository,
} from '../repositories/student-auth.repository';
import { recordLoginFailure } from './record-login-failure';
import { type ClientMeta, StudentSessionIssuer } from './student-session-issuer.service';

export interface LoginStudentCommand {
  referenceNumber: string;
  password: string;
}

const INVALID_CREDENTIALS = 'The reference number or password is incorrect.';

/** Student login with lockout (Rule 11, BR-AUTH-3). Errors never reveal whether an account exists. */
@Injectable()
export class LoginStudentService {
  private timingHash?: Promise<string>;

  constructor(
    private readonly students: StudentAuthRepository,
    private readonly sessions: StudentSessionIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(command: LoginStudentCommand, meta: ClientMeta): Promise<AuthSession> {
    const student = await this.students.findCredentials(command.referenceNumber);
    if (!student) {
      await this.spendEquivalentTime(command.password);
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID_CREDENTIALS);
    }
    const now = this.clock.now();
    this.assertNotLockedOut(student, now);

    if (!(await verify(student.passwordHash, command.password))) {
      await this.handleFailure(student, now);
    }
    // Checked only after the right password, so the answer never tells a stranger that a
    // locked or deactivated account exists (BR-AUTH-9).
    this.assertActive(student);
    await this.students.saveLoginState(student.id, recordSuccessfulLogin());
    const issued = await this.sessions.issue({
      studentId: student.id,
      isOnboardingComplete: student.isOnboardingComplete,
      meta,
    });
    return issued.session;
  }

  private assertActive(student: StudentCredentials): void {
    if (student.status === 'ACTIVE') return;
    throw new AppError(
      ErrorCode.ACCOUNT_LOCKED,
      'This account is not active. Please contact the mess office.',
    );
  }

  private assertNotLockedOut(student: StudentCredentials, now: Date): void {
    if (isLockedOut(student, now)) {
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, 'Too many failed attempts. Try again later.', {
        lockedUntil: student.lockedUntil?.toISOString(),
      });
    }
  }

  private async handleFailure(student: StudentCredentials, now: Date): Promise<never> {
    const next = await recordLoginFailure(this.students, student.id, student, now);
    if (isLockedOut(next, now)) {
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, 'Too many failed attempts. Try again later.', {
        lockedUntil: next.lockedUntil?.toISOString(),
      });
    }
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, INVALID_CREDENTIALS);
  }

  // Verifying against a throwaway hash keeps response time similar for unknown numbers.
  private async spendEquivalentTime(password: string): Promise<void> {
    this.timingHash ??= hash('timing-equalizer-not-a-real-password');
    await verify(await this.timingHash, password);
  }
}
