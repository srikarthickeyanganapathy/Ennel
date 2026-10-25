import { Injectable } from '@nestjs/common';
import {
  type AttendanceCounter,
  type AttendanceLookup,
  type AttendanceLookupQuery,
  type AttendanceWindowQuery,
  type BusinessDate,
  ErrorCode,
  type MealType,
  toBusinessDate,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { decideManualMark } from '../../../attendance/domain/attendance-rules';
import {
  activeMealType,
  attendanceWindow,
  windowPhase,
} from '../../../attendance/domain/attendance-window';
import {
  AttendanceRepository,
  type MealWithSlots,
  type WindowBookingRow,
} from '../../../attendance/repositories/attendance.repository';
import { AdminAttendanceRepository } from '../repositories/admin-attendance.repository';

const RECENT_MARKS = 15;
/** Meals that were (or still are) expected at the counter: not cancelled, leave or closed. */
const SERVED = new Set(['BOOKED', 'COMPLETED', 'NO_SHOW']);

/** The live counter and reference-number search (Admin §I). */
@Injectable()
export class AttendanceCounterService {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly admin: AdminAttendanceRepository,
    private readonly clock: Clock,
  ) {}

  async meal(mealType: MealType, tx?: TransactionClient): Promise<MealWithSlots> {
    const meal = (await this.attendance.listMeals(tx)).find((item) => item.mealType === mealType);
    if (!meal) throw new AppError(ErrorCode.NOT_FOUND, 'This meal is not being served.');
    return meal;
  }

  /** The meal the counter opens on: the open window, else the next one today (Admin §I). */
  async active(): Promise<AttendanceWindowQuery> {
    const now = this.clock.now();
    const date = toBusinessDate(now);
    const meals = await this.attendance.listMeals();
    const mealType = activeMealType(meals, date, now);
    if (!mealType) throw new AppError(ErrorCode.NOT_FOUND, 'No meals are being served.');
    return { date, mealType };
  }

  async counter(date: BusinessDate, mealType: MealType): Promise<AttendanceCounter> {
    const meal = await this.meal(mealType);
    const window = attendanceWindow(date, meal);
    const phase = windowPhase(window, this.clock.now());
    const bookings = (await this.attendance.windowBookings(date, meal.id)).filter((booking) =>
      SERVED.has(booking.status),
    );
    const bookingless = await this.admin.countBookinglessAttendance(date, meal.id);
    return {
      date,
      mealType,
      mealName: meal.mealName,
      opensAt: window.opensAt.toISOString(),
      closesAt: window.closesAt.toISOString(),
      phase,
      isFinalised: phase === 'CLOSED' && !bookings.some((booking) => booking.status === 'BOOKED'),
      outage: await this.admin.activeOutage(),
      totals: {
        booked: bookings.length,
        attended: bookings.filter((booking) => booking.hasAttendance).length + bookingless,
        noShow: bookings.filter((booking) => booking.status === 'NO_SHOW').length,
      },
      slots: meal.slots.map((slot) => slotCounts(slot, bookings)).filter((slot) => slot.booked > 0),
      recent: await this.admin.recentMarks(date, meal.id, RECENT_MARKS),
    };
  }

  /** Who is at the counter, their booking for the meal and whether they can be marked present. */
  async lookup(query: AttendanceLookupQuery, tx?: TransactionClient): Promise<AttendanceLookup> {
    const student = await this.attendance.findStudentByReference(
      query.referenceNumber.replace(/[\s-]/g, ''),
    );
    if (!student) {
      throw new AppError(ErrorCode.NOT_FOUND, 'No student has this reference number.');
    }
    const meal = await this.meal(query.mealType, tx);
    const booking = await this.admin.bookingAtCounter(student.id, query.date, meal.id, tx);
    const attendance = await this.attendance.findAttendance(student.id, query.date, meal.id, tx);
    const decision = decideManualMark({
      phase: windowPhase(attendanceWindow(query.date, meal), this.clock.now()),
      bookingStatus: booking?.status ?? null,
      hasAttendance: attendance !== null,
    });
    return {
      student,
      booking: booking
        ? {
            id: booking.id,
            slotLabel: booking.slotLabel,
            dietType: booking.dietType,
            status: booking.status,
          }
        : null,
      attendance: attendance
        ? {
            source: attendance.source,
            recordedAt: attendance.recordedAt.toISOString(),
            verifiedAt: attendance.verifiedAt?.toISOString() ?? null,
          }
        : null,
      canMark: decision.canMark,
      note: decision.note,
      needsReason: decision.needsReason,
    };
  }
}

function slotCounts(slot: { id: string; label: string }, bookings: WindowBookingRow[]) {
  const inSlot = bookings.filter((booking) => booking.slotId === slot.id);
  return {
    slotId: slot.id,
    label: slot.label,
    booked: inSlot.length,
    attended: inSlot.filter((booking) => booking.hasAttendance).length,
  };
}
