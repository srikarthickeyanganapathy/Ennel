import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { Prisma, type StudentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type LoginLockState } from '../domain/login-lockout';

export interface RosterForRegistration {
  rosterEntryId: string;
  isActive: boolean;
  hasStudentAccount: boolean;
  fullName: string;
  department: string;
  academicYear: number;
  hostelBlockId: string | null;
  roomNumber: string | null;
  email: string | null;
}

export interface NewStudent {
  rosterEntryId: string;
  passwordHash: string;
  fullName: string;
  department: string;
  academicYear: number;
  hostelBlockId: string | null;
  roomNumber: string | null;
  email: string | null;
}

export interface StudentCredentials extends LoginLockState {
  id: string;
  passwordHash: string;
  status: StudentStatus;
  isOnboardingComplete: boolean;
}

export abstract class StudentAuthRepository {
  abstract findRosterForRegistration(
    referenceNumber: string,
    tx?: TransactionClient,
  ): Promise<RosterForRegistration | null>;
  abstract createStudent(student: NewStudent, tx?: TransactionClient): Promise<{ id: string }>;
  abstract findCredentials(referenceNumber: string): Promise<StudentCredentials | null>;
  abstract findCredentialsById(id: string): Promise<StudentCredentials | null>;
  abstract saveLoginState(studentId: string, state: LoginLockState): Promise<void>;
  abstract resetPassword(
    studentId: string,
    passwordHash: string,
    clearsOnboarding: boolean,
    tx: TransactionClient,
  ): Promise<void>;
}

const CREDENTIAL_SELECT = {
  id: true,
  passwordHash: true,
  status: true,
  failedLoginCount: true,
  lockedUntil: true,
  onboardingCompletedAt: true,
} satisfies Prisma.StudentSelect;

type CredentialRow = Prisma.StudentGetPayload<{ select: typeof CREDENTIAL_SELECT }>;

function toCredentials(row: CredentialRow): StudentCredentials {
  const { onboardingCompletedAt, ...rest } = row;
  return { ...rest, isOnboardingComplete: onboardingCompletedAt !== null };
}

@Injectable()
export class PrismaStudentAuthRepository extends StudentAuthRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findRosterForRegistration(
    referenceNumber: string,
    tx: TransactionClient = this.prisma,
  ): Promise<RosterForRegistration | null> {
    const entry = await tx.collegeRosterEntry.findUnique({
      where: { referenceNumber },
      include: { student: { select: { id: true } } },
    });
    if (!entry) return null;
    return {
      rosterEntryId: entry.id,
      isActive: entry.isActive,
      hasStudentAccount: entry.student !== null,
      fullName: entry.fullName,
      department: entry.department,
      academicYear: entry.academicYear,
      hostelBlockId: entry.hostelBlockId,
      roomNumber: entry.roomNumber,
      email: entry.email,
    };
  }

  async createStudent(
    student: NewStudent,
    tx: TransactionClient = this.prisma,
  ): Promise<{ id: string }> {
    try {
      return await tx.student.create({ data: student, select: { id: true } });
    } catch (error) {
      // Two simultaneous registrations for one roster entry: the unique index decides.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          ErrorCode.ALREADY_REGISTERED,
          'An account already exists. Please log in.',
        );
      }
      throw error;
    }
  }

  async findCredentials(referenceNumber: string): Promise<StudentCredentials | null> {
    const row = await this.prisma.student.findFirst({
      where: { rosterEntry: { referenceNumber } },
      select: CREDENTIAL_SELECT,
    });
    return row ? toCredentials(row) : null;
  }

  async findCredentialsById(id: string): Promise<StudentCredentials | null> {
    const row = await this.prisma.student.findUnique({ where: { id }, select: CREDENTIAL_SELECT });
    return row ? toCredentials(row) : null;
  }

  async saveLoginState(studentId: string, state: LoginLockState): Promise<void> {
    await this.prisma.student.update({ where: { id: studentId }, data: state });
  }

  async resetPassword(
    studentId: string,
    passwordHash: string,
    clearsOnboarding: boolean,
    tx: TransactionClient,
  ): Promise<void> {
    await tx.student.update({
      where: { id: studentId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        ...(clearsOnboarding ? { onboardingCompletedAt: null } : {}),
        version: { increment: 1 },
      },
    });
  }
}
