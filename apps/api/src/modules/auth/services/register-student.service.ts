import { Injectable } from '@nestjs/common';
import { type AuthSession } from '@ennel/shared';
import { hash } from 'argon2';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { assertCanRegister } from '../domain/registration';
import { StudentAuthRepository } from '../repositories/student-auth.repository';
import { type ClientMeta, StudentSessionIssuer } from './student-session-issuer.service';

export interface RegisterStudentCommand {
  referenceNumber: string;
  password: string;
}

/**
 * Spec §3 Screen 3 "Create Account": creates the account from the roster entry, prefilling
 * college data (Screen 5), and signs the student in. Passwords are argon2id-hashed (Rule 11).
 */
@Injectable()
export class RegisterStudentService {
  constructor(
    private readonly students: StudentAuthRepository,
    private readonly sessions: StudentSessionIssuer,
    private readonly transactions: TransactionRunner,
  ) {}

  async execute(command: RegisterStudentCommand, meta: ClientMeta): Promise<AuthSession> {
    // Hash outside the transaction so it never holds a connection during the slow step.
    const passwordHash = await hash(command.password);
    return this.transactions.run(async (tx) => {
      const roster = await this.students.findRosterForRegistration(command.referenceNumber, tx);
      assertCanRegister(roster);
      const { id } = await this.students.createStudent(
        {
          rosterEntryId: roster.rosterEntryId,
          passwordHash,
          fullName: roster.fullName,
          department: roster.department,
          academicYear: roster.academicYear,
          hostelBlockId: roster.hostelBlockId,
          roomNumber: roster.roomNumber,
          email: roster.email,
        },
        tx,
      );
      const issued = await this.sessions.issue({
        studentId: id,
        isOnboardingComplete: false,
        meta,
        tx,
      });
      return issued.session;
    });
  }
}
