import { Injectable } from '@nestjs/common';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { StudentSessionRepository } from '../repositories/student-session.repository';

/** Lets staff use cases (lock, deactivate, reset) end a student's sessions in their transaction. */
@Injectable()
export class StudentSessionsAdminService {
  constructor(
    private readonly sessions: StudentSessionRepository,
    private readonly clock: Clock,
  ) {}

  revokeAllWithin(tx: TransactionClient, studentId: string): Promise<number> {
    return this.sessions.revokeAllForStudent(studentId, this.clock.now(), tx);
  }
}
