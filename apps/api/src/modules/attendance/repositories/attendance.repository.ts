import { Injectable } from '@nestjs/common';
import {
  type AttendanceSource,
  type BookingStatus,
  type BusinessDate,
  type MealType,
} from '@ennel/shared';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type MealTiming, type OutagePeriod } from '../domain/attendance-window';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);

export interface MealWithSlots extends MealTiming {
  id: string;
  mealName: string;
  slots: { id: string; label: string }[];
}

export interface WindowBookingRow {
  id: string;
  studentId: string;
  slotId: string;
  status: BookingStatus;
  version: number;
  hasAttendance: boolean;
}

export interface StudentAtCounter {
  id: string;
  fullName: string;
  referenceNumber: string;
  blockName: string | null;
}

export interface AttendanceWrite {
  studentId: string;
  bookingId: string | null;
  date: BusinessDate;
  mealId: string;
  source: AttendanceSource;
  verifiedAt: Date | null;
  recordedAt: Date;
  recordedById: string | null;
  importJobId: string | null;
  outageWindowId: string | null;
}

/** Attendance records, outage windows and window bookings (Admin §I, BR-ATT, BR-NS-1/7). */
@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listMeals(tx: TransactionClient = this.prisma): Promise<MealWithSlots[]> {
    const meals = await tx.meal.findMany({
      where: { isActive: true },
      orderBy: { serviceStartMinute: 'asc' },
      include: {
        slots: {
          where: { deletedAt: null },
          orderBy: { startMinute: 'asc' },
          select: { id: true, label: true },
        },
      },
    });
    return meals.map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      mealName: meal.displayName,
      serviceStartMinute: meal.serviceStartMinute,
      serviceEndMinute: meal.serviceEndMinute,
      attendanceGraceMinutes: meal.attendanceGraceMinutes,
      slots: meal.slots,
    }));
  }

  async windowBookings(
    date: BusinessDate,
    mealId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<WindowBookingRow[]> {
    const rows = await tx.booking.findMany({
      where: { mealDate: toDbDate(date), mealId },
      select: {
        id: true,
        studentId: true,
        slotId: true,
        status: true,
        version: true,
        attendanceRecord: { select: { id: true } },
      },
    });
    return rows.map(({ attendanceRecord, ...row }) => ({
      ...row,
      hasAttendance: attendanceRecord !== null,
    }));
  }

  async findStudentByReference(referenceNumber: string): Promise<StudentAtCounter | null> {
    const student = await this.prisma.student.findFirst({
      where: { rosterEntry: { referenceNumber } },
      select: {
        id: true,
        fullName: true,
        rosterEntry: { select: { referenceNumber: true } },
        hostelBlock: { select: { name: true } },
      },
    });
    if (!student) return null;
    return {
      id: student.id,
      fullName: student.fullName,
      referenceNumber: student.rosterEntry.referenceNumber,
      blockName: student.hostelBlock?.name ?? null,
    };
  }

  /** Reference number → student ID, for imports and provider data. */
  async studentIdsByReference(
    referenceNumbers: string[],
    tx: TransactionClient = this.prisma,
  ): Promise<Map<string, string>> {
    const students = await tx.student.findMany({
      where: { rosterEntry: { referenceNumber: { in: referenceNumbers } } },
      select: { id: true, rosterEntry: { select: { referenceNumber: true } } },
    });
    return new Map(students.map((student) => [student.rosterEntry.referenceNumber, student.id]));
  }

  async findAttendance(
    studentId: string,
    date: BusinessDate,
    mealId: string,
    tx: TransactionClient = this.prisma,
  ) {
    return tx.attendanceRecord.findUnique({
      where: { studentId_mealDate_mealId: { studentId, mealDate: toDbDate(date), mealId } },
      select: { source: true, recordedAt: true, verifiedAt: true },
    });
  }

  /** Returns false when the student already has attendance for this meal (one record, BR-ATT-1). */
  async createRecord(write: AttendanceWrite, tx: TransactionClient): Promise<boolean> {
    const result = await tx.attendanceRecord.createMany({
      data: [
        {
          studentId: write.studentId,
          bookingId: write.bookingId,
          mealDate: toDbDate(write.date),
          mealId: write.mealId,
          source: write.source,
          verifiedAt: write.verifiedAt,
          recordedAt: write.recordedAt,
          recordedById: write.recordedById,
          importJobId: write.importJobId,
          outageWindowId: write.outageWindowId,
        },
      ],
      skipDuplicates: true,
    });
    return result.count === 1;
  }

  async createNoShowEvent(
    data: {
      bookingId: string;
      studentId: string;
      date: BusinessDate;
      mealType: MealType;
      status: 'COUNTED' | 'HELD_FOR_REVIEW';
    },
    tx: TransactionClient,
  ): Promise<string> {
    // One event per booking (unique); the booking was just marked No-show in this transaction.
    const row = await tx.noShowEvent.create({
      data: {
        bookingId: data.bookingId,
        studentId: data.studentId,
        mealDate: toDbDate(data.date),
        mealType: data.mealType,
        status: data.status,
      },
      select: { id: true },
    });
    return row.id;
  }

  async outagesBetween(
    from: Date,
    to: Date,
    tx: TransactionClient = this.prisma,
  ): Promise<OutagePeriod[]> {
    return tx.attendanceOutageWindow.findMany({
      where: { startedAt: { lt: to }, OR: [{ endedAt: null }, { endedAt: { gt: from } }] },
      select: { startedAt: true, endedAt: true },
    });
  }
}
