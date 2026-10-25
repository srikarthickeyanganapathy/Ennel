import { Injectable } from '@nestjs/common';
import {
  type AttendanceImport,
  type AttendanceMark,
  type BusinessDate,
  type DietType,
  type MealType,
  type OutageWindow,
} from '@ennel/shared';
import { type Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { type WindowBookingRow } from '../../../attendance/repositories/attendance.repository';
import { type ClassifiedAttendanceRow, type StudentWindowState } from '../domain/attendance-import';

const toDbDate = (date: BusinessDate) => new Date(`${date}T00:00:00Z`);

const OUTAGE_SELECT = {
  id: true,
  startedAt: true,
  endedAt: true,
  reason: true,
  startedBy: { select: { fullName: true } },
} as const;
type OutageRow = Prisma.AttendanceOutageWindowGetPayload<{ select: typeof OUTAGE_SELECT }>;

interface ImportContext {
  date: BusinessDate;
  mealType: MealType;
  appliedRows?: number;
}

/** Counter, outage mode and attendance imports for staff (Admin §I). */
@Injectable()
export class AdminAttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async bookingAtCounter(
    studentId: string,
    date: BusinessDate,
    mealId: string,
    tx: TransactionClient = this.prisma,
  ): Promise<CounterBooking | null> {
    const row = await tx.booking.findUnique({
      where: { studentId_mealDate_mealId: { studentId, mealDate: toDbDate(date), mealId } },
      select: {
        id: true,
        studentId: true,
        slotId: true,
        status: true,
        version: true,
        dietType: true,
        slot: { select: { label: true } },
        attendanceRecord: { select: { id: true } },
      },
    });
    if (!row) return null;
    const { slot, attendanceRecord, ...booking } = row;
    return { ...booking, slotLabel: slot.label, hasAttendance: attendanceRecord !== null };
  }

  async countBookinglessAttendance(date: BusinessDate, mealId: string): Promise<number> {
    return this.prisma.attendanceRecord.count({
      where: { mealDate: toDbDate(date), mealId, bookingId: null },
    });
  }

  async recentMarks(date: BusinessDate, mealId: string, limit: number): Promise<AttendanceMark[]> {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: { mealDate: toDbDate(date), mealId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
      select: {
        source: true,
        recordedAt: true,
        student: { select: { fullName: true, rosterEntry: { select: { referenceNumber: true } } } },
        booking: { select: { slot: { select: { label: true } } } },
        recordedBy: { select: { fullName: true } },
      },
    });
    return rows.map((row) => ({
      studentName: row.student.fullName,
      referenceNumber: row.student.rosterEntry.referenceNumber,
      slotLabel: row.booking?.slot.label ?? null,
      source: row.source,
      recordedAt: row.recordedAt.toISOString(),
      recordedByName: row.recordedBy?.fullName ?? null,
    }));
  }

  /** Each listed student's booking, attendance and No-show state for one meal (import preview). */
  async studentWindowStates(
    date: BusinessDate,
    mealId: string,
    referenceNumbers: string[],
  ): Promise<Map<string, StudentWindowState>> {
    const mealDate = toDbDate(date);
    const students = await this.prisma.student.findMany({
      where: { rosterEntry: { referenceNumber: { in: referenceNumbers } } },
      select: {
        id: true,
        rosterEntry: { select: { referenceNumber: true } },
        bookings: {
          where: { mealDate, mealId },
          select: { status: true, noShowEvent: { select: { status: true } } },
        },
        attendanceRecords: { where: { mealDate, mealId }, select: { id: true } },
      },
    });
    return new Map(
      students.map((student) => {
        const booking = student.bookings[0];
        return [
          student.rosterEntry.referenceNumber,
          {
            studentId: student.id,
            bookingStatus: booking?.status ?? null,
            hasAttendance: student.attendanceRecords.length > 0,
            noShowStatus: booking?.noShowEvent?.status ?? null,
          },
        ];
      }),
    );
  }

  /** ADR-0025: an import after an outage clears the held No-show it disproves. */
  async excludeHeldNoShow(
    bookingId: string,
    staffId: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.noShowEvent.updateMany({
      where: { bookingId, status: 'HELD_FOR_REVIEW' },
      data: {
        status: 'EXCLUDED',
        exclusionCause: 'OUTAGE_REVIEW_DISMISSED',
        excludedById: staffId,
        excludedReason: 'Attendance imported after the outage',
        excludedAt: now,
      },
    });
    return result.count === 1;
  }

  async activeOutage(tx: TransactionClient = this.prisma): Promise<OutageWindow | null> {
    const row = await tx.attendanceOutageWindow.findFirst({
      where: { endedAt: null },
      orderBy: { startedAt: 'desc' },
      select: OUTAGE_SELECT,
    });
    return row ? toOutage(row) : null;
  }

  /** Outage mode is global, so turning it on or off is serialised. */
  async lockOutage(tx: TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('attendance:outage'))`;
  }

  async startOutage(
    staffId: string,
    reason: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<OutageWindow> {
    const row = await tx.attendanceOutageWindow.create({
      data: { startedAt: now, reason, startedById: staffId },
      select: OUTAGE_SELECT,
    });
    return toOutage(row);
  }

  async endOutage(id: string, staffId: string, now: Date, tx: TransactionClient): Promise<void> {
    await tx.attendanceOutageWindow.update({
      where: { id },
      data: { endedAt: now, endedById: staffId },
    });
  }

  async createImport(
    data: {
      id: string;
      fileName: string;
      storageKey: string;
      staffId: string;
      context: ImportContext;
      rows: ClassifiedAttendanceRow[];
    },
    tx: TransactionClient,
  ): Promise<void> {
    const valid = data.rows.filter((row) => row.outcome === 'VALID').length;
    await tx.importJob.create({
      data: {
        id: data.id,
        type: 'ATTENDANCE',
        status: 'VALIDATED',
        fileName: data.fileName,
        storageKey: data.storageKey,
        context: { ...data.context },
        totalRows: data.rows.length,
        validRows: valid,
        invalidRows: data.rows.length - valid,
        createdById: data.staffId,
      },
    });
    await tx.importJobRow.createMany({
      data: data.rows.map((row) => ({
        importJobId: data.id,
        rowNumber: row.rowNumber,
        raw: { referenceNumber: row.referenceNumber, studentId: row.studentId },
        outcome: row.outcome,
        errors: row.message ? { message: row.message } : undefined,
      })),
    });
  }

  async findImport(id: string, tx: TransactionClient = this.prisma): Promise<StoredImport | null> {
    const job = await tx.importJob.findFirst({
      where: { id, type: 'ATTENDANCE' },
      include: { rows: { orderBy: { rowNumber: 'asc' } } },
    });
    if (!job) return null;
    const context = job.context as unknown as ImportContext;
    return {
      summary: {
        id: job.id,
        status: importStatus(job.status),
        fileName: job.fileName,
        date: context.date,
        mealType: context.mealType,
        totalRows: job.totalRows,
        validRows: job.validRows,
        invalidRows: job.invalidRows,
        appliedRows: context.appliedRows ?? 0,
        rows: job.rows.map((row) => {
          const raw = row.raw as { referenceNumber?: string };
          const errors = row.errors as { message?: string } | null;
          return {
            rowNumber: row.rowNumber,
            referenceNumber: raw.referenceNumber ?? '',
            outcome: row.outcome as AttendanceImport['rows'][number]['outcome'],
            message: errors?.message ?? null,
          };
        }),
      },
      validStudentIds: job.rows
        .filter((row) => row.outcome === 'VALID')
        .map((row) => (row.raw as { studentId?: string }).studentId)
        .filter((studentId): studentId is string => typeof studentId === 'string'),
    };
  }

  /** Returns false if the import was already confirmed (two confirms at once). */
  async completeImport(
    id: string,
    context: ImportContext,
    now: Date,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.importJob.updateMany({
      where: { id, status: 'VALIDATED' },
      data: { status: 'COMPLETED', confirmedAt: now, completedAt: now, context: { ...context } },
    });
    return result.count === 1;
  }
}

export interface CounterBooking extends WindowBookingRow {
  slotLabel: string;
  dietType: DietType;
}

export interface StoredImport {
  summary: AttendanceImport;
  validStudentIds: string[];
}

function toOutage(row: OutageRow): OutageWindow {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    reason: row.reason,
    startedByName: row.startedBy.fullName,
  };
}

/** Attendance imports skip the roster's upload and processing steps (validated on upload). */
function importStatus(status: string): AttendanceImport['status'] {
  if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') return status;
  return 'VALIDATED';
}
