import { Injectable } from '@nestjs/common';
import { type StudentProfileField } from '@ennel/shared';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

export interface StudentProfileRecord {
  id: string;
  referenceNumber: string;
  fullName: string;
  department: string;
  academicYear: number;
  hostelBlockId: string | null;
  hostelName: string | null;
  blockName: string | null;
  roomNumber: string | null;
  phone: string | null;
  parentPhone: string | null;
  email: string | null;
  photoKey: string | null;
  isOnboardingComplete: boolean;
  defaultBookingEnabled: boolean;
  version: number;
}

export type ProfileChanges = Partial<{
  [K in StudentProfileField]: K extends 'academicYear'
    ? number
    : K extends 'email'
      ? string | null
      : string;
}>;

export abstract class StudentProfileRepository {
  abstract findById(studentId: string): Promise<StudentProfileRecord | null>;
  /** Applies changes only if `expectedVersion` matches; returns false on a stale version. */
  abstract update(
    studentId: string,
    expectedVersion: number,
    changes: ProfileChanges,
  ): Promise<boolean>;
  /** Returns the previous photo key, if any. */
  abstract replacePhotoKey(studentId: string, photoKey: string): Promise<string | null>;
  abstract completeOnboarding(
    studentId: string,
    changes: ProfileChanges,
    defaultBookingEnabled: boolean,
    completedAt: Date,
    tx?: TransactionClient,
  ): Promise<void>;
  abstract isActiveHostelBlock(hostelBlockId: string): Promise<boolean>;
}

@Injectable()
export class PrismaStudentProfileRepository extends StudentProfileRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(studentId: string): Promise<StudentProfileRecord | null> {
    const row = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        rosterEntry: { select: { referenceNumber: true } },
        hostelBlock: { select: { name: true, hostel: { select: { name: true } } } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      referenceNumber: row.rosterEntry.referenceNumber,
      fullName: row.fullName,
      department: row.department,
      academicYear: row.academicYear,
      hostelBlockId: row.hostelBlockId,
      hostelName: row.hostelBlock?.hostel.name ?? null,
      blockName: row.hostelBlock?.name ?? null,
      roomNumber: row.roomNumber,
      phone: row.phone,
      parentPhone: row.parentPhone,
      email: row.email,
      photoKey: row.photoKey,
      isOnboardingComplete: row.onboardingCompletedAt !== null,
      defaultBookingEnabled: row.defaultBookingEnabled,
      version: row.version,
    };
  }

  async update(
    studentId: string,
    expectedVersion: number,
    changes: ProfileChanges,
  ): Promise<boolean> {
    const result = await this.prisma.student.updateMany({
      where: { id: studentId, version: expectedVersion },
      data: { ...changes, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async replacePhotoKey(studentId: string, photoKey: string): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        select: { photoKey: true },
      });
      await tx.student.update({
        where: { id: studentId },
        data: { photoKey, version: { increment: 1 } },
      });
      return previous.photoKey;
    });
  }

  async completeOnboarding(
    studentId: string,
    changes: ProfileChanges,
    defaultBookingEnabled: boolean,
    completedAt: Date,
    tx: TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.student.update({
      where: { id: studentId },
      data: {
        ...changes,
        defaultBookingEnabled,
        onboardingCompletedAt: completedAt,
        version: { increment: 1 },
      },
    });
  }

  async isActiveHostelBlock(hostelBlockId: string): Promise<boolean> {
    const count = await this.prisma.hostelBlock.count({
      where: { id: hostelBlockId, isActive: true, hostel: { isActive: true } },
    });
    return count > 0;
  }
}
